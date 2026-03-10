package main

import (
	"fmt"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
)

const mergeThreadUsage = `
/wrangler merge thread [ROOT_MESSAGE_ID or ROOT_MESSAGE_LINK] [TARGET_ROOT_MESSAGE_ID or TARGET_ROOT_MESSAGE_LINK]
  Merge the messages of two threads
    - Message creation timestamps of both threads will be preserved. This could result in merged threads having messages that seem out of order or with different contexts.
	- Use the '/wrangler list' commands to get message and channel IDs
`

func getMergeThreadMessage() string {
	return codeBlock(fmt.Sprintf("`Error: missing arguments\n\n%s", mergeThreadUsage))
}

func (p *Plugin) runMergeThreadCommand(args []string, extra *model.CommandArgs) (*model.CommandResponse, bool, error) {
	if !p.getConfiguration().MergeThreadEnable {
		return getCommandResponse(model.CommandResponseTypeEphemeral, "Merge thread command is not enabled"), true, nil
	}
	if len(args) < 2 {
		return getCommandResponse(model.CommandResponseTypeEphemeral, getMergeThreadMessage()), true, nil
	}
	originalPostID := cleanInputID(args[0], extra.SiteURL)
	mergeToPostID := cleanInputID(args[1], extra.SiteURL)

	postListResponse, appErr := p.API.GetPostThread(originalPostID)
	if appErr != nil {
		return getCommandResponse(model.CommandResponseTypeEphemeral, fmt.Sprintf("Error: unable to get post with ID %s; ensure this is correct", originalPostID)), true, nil
	}
	wpl := buildWranglerPostList(postListResponse)
	originalChannelID := wpl.RootPost().ChannelId

	targetPostListResponse, appErr := p.API.GetPostThread(mergeToPostID)
	if appErr != nil {
		return getCommandResponse(model.CommandResponseTypeEphemeral, fmt.Sprintf("Error: unable to get post with ID %s; ensure this is correct", mergeToPostID)), true, nil
	}
	targetRootPost := getRootPostFromPostList(targetPostListResponse)

	err := p.ensureOriginalAndTargetChannelMember(originalChannelID, targetRootPost.ChannelId, extra.UserId)
	if err != nil {
		return getCommandResponse(model.CommandResponseTypeEphemeral, err.Error()), true, nil
	}

	originalChannel, appErr := p.API.GetChannel(originalChannelID)
	if appErr != nil {
		return nil, false, errors.Errorf("unable to get channel with ID %s", originalChannelID)
	}
	targetChannel, appErr := p.API.GetChannel(targetRootPost.ChannelId)
	if appErr != nil {
		return nil, false, errors.Errorf("unable to get channel with ID %s", targetRootPost.ChannelId)
	}

	response, userErr, err := p.validateMerge(wpl, targetRootPost, originalChannel, targetChannel, extra)
	if response != nil || err != nil {
		return response, userErr, err
	}

	targetTeam, appErr := p.API.GetTeam(targetChannel.TeamId)
	if appErr != nil {
		return nil, false, errors.Errorf("unable to get team with ID %s", targetChannel.TeamId)
	}

	// Begin merging the thread.
	p.API.LogInfo("Wrangler is merging a thread",
		"user_id", extra.UserId,
		"original_post_id", wpl.RootPost().Id,
		"original_channel_id", originalChannel.Id,
		"target_root_post_id", targetRootPost.Id,
		"target_root_post_channel_id", targetRootPost.ChannelId,
		"merge_message_count", fmt.Sprintf("%d", wpl.NumPosts()),
	)

	// To merge threads, we first copy the original messages(s) to the new
	// thread and later delete the original messages(s).
	err = p.mergeWranglerPostlist(wpl, targetRootPost)
	if err != nil {
		return nil, false, err
	}

	// Cleanup is handled by simply deleting the root post. Any comments/replies
	// are automatically marked as deleted for us.
	appErr = p.API.DeletePost(wpl.RootPost().Id)
	if appErr != nil {
		return nil, false, errors.Wrap(appErr, "unable to delete post")
	}

	p.API.LogInfo("Wrangler thread merge complete",
		"user_id", extra.UserId,
		"target_root_post_id", targetRootPost.Id,
		"target_root_post_channel_id", targetRootPost.ChannelId,
	)

	newPostLink := makePostLink(*p.API.GetConfig().ServiceSettings.SiteURL, targetTeam.Name, targetRootPost.Id)

	return getCommandResponse(model.CommandResponseTypeEphemeral, fmt.Sprintf("A thread with %d message(s) has been merged: %s\n", wpl.NumPosts(), newPostLink)), false, nil
}

func (p *Plugin) mergeWranglerPostlist(wpl *WranglerPostList, targetRootPost *model.Post) error {
	var err error
	var appErr *model.AppError

	if wpl.ContainsFileAttachments() {
		// The thread contains at least one attachment. To properly move the
		// thread, the files will have to be re-uploaded. This is completed
		// before any messages are moved.
		// TODO: check number of files that need to be re-uploaded or file size?
		p.API.LogInfo("Wrangler is re-uploading file attachments",
			"file_count", wpl.FileAttachmentCount,
		)

		for _, post := range wpl.Posts {
			var newFileIDs []string
			var fileBytes []byte
			var oldFileInfo, newFileInfo *model.FileInfo
			for _, fileID := range post.FileIds {
				oldFileInfo, appErr = p.API.GetFileInfo(fileID)
				if appErr != nil {
					return errors.Wrap(appErr, "unable to lookup file info to re-upload")
				}
				fileBytes, appErr = p.API.GetFile(fileID)
				if appErr != nil {
					return errors.Wrap(appErr, "unable to get file bytes to re-upload")
				}
				newFileInfo, appErr = p.API.UploadFile(fileBytes, targetRootPost.ChannelId, oldFileInfo.Name)
				if appErr != nil {
					return errors.Wrap(appErr, "unable to re-upload file")
				}

				newFileIDs = append(newFileIDs, newFileInfo.Id)
			}

			post.FileIds = newFileIDs
		}
	}

	for _, post := range wpl.Posts {
		var reactions []*model.Reaction

		// Store reactions to be reapplied later.
		reactions, appErr = p.API.GetReactions(post.Id)
		if appErr != nil {
			// Reaction-based errors are logged, but do not cause the plugin to
			// abort the move thread process.
			p.API.LogError("Failed to get reactions on original post", "err", appErr)
		}

		newPost := post.Clone()
		cleanPostID(newPost)
		newPost.RootId = targetRootPost.Id
		newPost.ChannelId = targetRootPost.ChannelId

		newPost, err = p.createPostWithRetries(newPost, 200*time.Millisecond, 3)
		if err != nil {
			return errors.Wrap(err, "unable to create new post")
		}

		for _, reaction := range reactions {
			reaction.PostId = newPost.Id
			_, appErr = p.API.AddReaction(reaction)
			if appErr != nil {
				// Reaction-based errors are logged, but do not cause the plugin to
				// abort the move thread process.
				p.API.LogError("Failed to reapply reactions to post", "err", appErr)
			}
		}
	}

	return nil
}
