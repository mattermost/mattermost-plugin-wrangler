package main

import (
	"fmt"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
)

const wrangerProp = "wrangler"

// validateMoveOrCopy performs validation on a provided post list to determine
// if all permissions are in place to allow the for the posts to be moved or
// copied.
func (p *Plugin) validateMoveOrCopy(wpl *WranglerPostList, originalChannel *model.Channel, targetChannel *model.Channel, extra *model.CommandArgs) (*model.CommandResponse, bool, error) {
	if wpl.NumPosts() == 0 {
		return nil, false, errors.New("The wrangler post list contains no posts")
	}

	if !p.API.HasPermissionToChannel(extra.UserId, targetChannel.Id, model.PermissionCreatePost) {
		return getCommandResponse(model.CommandResponseTypeEphemeral, fmt.Sprintf("Error: you don't have permissions to create posts in channel %s", targetChannel.Name)), true, nil
	}

	config := p.getConfiguration()

	switch originalChannel.Type {
	case model.ChannelTypePrivate:
		if !config.MoveThreadFromPrivateChannelEnable {
			return getCommandResponse(model.CommandResponseTypeEphemeral, "Wrangler is currently configured to not allow moving posts from private channels"), false, nil
		}
	case model.ChannelTypeDirect:
		if !config.MoveThreadFromDirectMessageChannelEnable {
			return getCommandResponse(model.CommandResponseTypeEphemeral, "Wrangler is currently configured to not allow moving posts from direct message channels"), false, nil
		}
	case model.ChannelTypeGroup:
		if !config.MoveThreadFromGroupMessageChannelEnable {
			return getCommandResponse(model.CommandResponseTypeEphemeral, "Wrangler is currently configured to not allow moving posts from group message channels"), false, nil
		}
	}

	if !originalChannel.IsGroupOrDirect() {
		// DM and GM channels are "teamless" so it doesn't make sense to check
		// the MoveThreadToAnotherTeamEnable config when dealing with those.
		if !config.MoveThreadToAnotherTeamEnable && targetChannel.TeamId != originalChannel.TeamId {
			return getCommandResponse(model.CommandResponseTypeEphemeral, "Wrangler is currently configured to not allow moving messages to different teams"), false, nil
		}
	}

	if config.MaxThreadCountMoveSizeInt() != 0 && config.MaxThreadCountMoveSizeInt() < wpl.NumPosts() {
		return getCommandResponse(model.CommandResponseTypeEphemeral, fmt.Sprintf("Error: the thread is %d posts long, but this command is configured to only move threads of up to %d posts", wpl.NumPosts(), config.MaxThreadCountMoveSizeInt())), true, nil
	}

	if wpl.RootPost().ChannelId != extra.ChannelId {
		return getCommandResponse(model.CommandResponseTypeEphemeral, "Error: this command must be run from the channel containing the post"), true, nil
	}

	_, appErr := p.API.GetChannelMember(targetChannel.Id, extra.UserId)
	if appErr != nil {
		return getCommandResponse(model.CommandResponseTypeEphemeral, fmt.Sprintf("Error: channel with ID %s doesn't exist or you are not a member", targetChannel.Id)), true, nil
	}

	if extra.RootId == wpl.RootPost().Id || extra.ParentId == wpl.RootPost().Id {
		return getCommandResponse(model.CommandResponseTypeEphemeral, "Error: this command cannot be run from inside the thread; please run directly in the channel containing the thread"), true, nil
	}

	return nil, false, nil
}

// validateMerge performs validation on a provided post list to determine if all
// permissions are in place to allow the for the posts to be merged into another
// thread.
func (p *Plugin) validateMerge(wpl *WranglerPostList, targetRootPost *model.Post, originalChannel *model.Channel, targetChannel *model.Channel, extra *model.CommandArgs) (*model.CommandResponse, bool, error) {
	if wpl.NumPosts() == 0 {
		return nil, false, errors.New("The wrangler post list contains no posts")
	}
	if targetRootPost == nil {
		return nil, false, errors.New("The target root post is nil")
	}
	if wpl.RootPost().Id == targetRootPost.Id {
		return getCommandResponse(model.CommandResponseTypeEphemeral, "Error: Original and target threads are the same"), true, nil
	}

	err := p.ensureOriginalAndTargetChannelMember(originalChannel.Id, targetChannel.Id, extra.UserId)
	if err != nil {
		return getCommandResponse(model.CommandResponseTypeEphemeral, err.Error()), true, nil
	}

	config := p.getConfiguration()

	switch originalChannel.Type {
	case model.ChannelTypePrivate:
		if !config.MoveThreadFromPrivateChannelEnable {
			return getCommandResponse(model.CommandResponseTypeEphemeral, "Wrangler is currently configured to not allow moving posts from private channels"), false, nil
		}
	case model.ChannelTypeDirect:
		if !config.MoveThreadFromDirectMessageChannelEnable {
			return getCommandResponse(model.CommandResponseTypeEphemeral, "Wrangler is currently configured to not allow moving posts from direct message channels"), false, nil
		}
	case model.ChannelTypeGroup:
		if !config.MoveThreadFromGroupMessageChannelEnable {
			return getCommandResponse(model.CommandResponseTypeEphemeral, "Wrangler is currently configured to not allow moving posts from group message channels"), false, nil
		}
	}

	if !originalChannel.IsGroupOrDirect() {
		// DM and GM channels are "teamless" so it doesn't make sense to check
		// the MoveThreadToAnotherTeamEnable config when dealing with those.
		if !config.MoveThreadToAnotherTeamEnable && targetChannel.TeamId != originalChannel.TeamId {
			return getCommandResponse(model.CommandResponseTypeEphemeral, "Wrangler is currently configured to not allow moving messages to different teams"), false, nil
		}
	}

	if config.MaxThreadCountMoveSizeInt() != 0 && config.MaxThreadCountMoveSizeInt() < wpl.NumPosts() {
		return getCommandResponse(model.CommandResponseTypeEphemeral, fmt.Sprintf("Error: the thread is %d posts long, but this command is configured to only move threads of up to %d posts", wpl.NumPosts(), config.MaxThreadCountMoveSizeInt())), true, nil
	}

	if wpl.RootPost().CreateAt < targetRootPost.CreateAt {
		return getCommandResponse(model.CommandResponseTypeEphemeral, "Error: Cannot merge older threads into newer threads. The destination thread must be older than the thread being moved."), true, nil
	}

	if extra.RootId == wpl.RootPost().Id || extra.ParentId == wpl.RootPost().Id {
		return getCommandResponse(model.CommandResponseTypeEphemeral, "Error: this command cannot be run from inside the thread; please run directly in the channel containing the thread"), true, nil
	}

	return nil, false, nil
}

func (p *Plugin) ensureOriginalAndTargetChannelMember(originalChannelID, targetChannelID, userID string) error {
	err := p.ensureChannelMember(originalChannelID, userID)
	if err != nil {
		return errors.Wrap(err, "Error: Original Channel")
	}
	err = p.ensureChannelMember(targetChannelID, userID)
	if err != nil {
		return errors.Wrap(err, "Error: Target Channel")
	}

	return nil
}

func (p *Plugin) ensureChannelMember(channelID, userID string) error {
	_, appErr := p.API.GetChannelMember(channelID, userID)
	if appErr != nil {
		return errors.Errorf("Channel with ID %s doesn't exist or you are not a member", channelID)
	}

	return nil
}

func (p *Plugin) copyWranglerPostlist(wpl *WranglerPostList, targetChannel *model.Channel) (*model.Post, error) {
	var err error
	var appErr *model.AppError
	var newRootPost *model.Post

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
					return nil, errors.Wrap(appErr, "unable to lookup file info to re-upload")
				}
				fileBytes, appErr = p.API.GetFile(fileID)
				if appErr != nil {
					return nil, errors.Wrap(appErr, "unable to get file bytes to re-upload")
				}
				newFileInfo, appErr = p.API.UploadFile(fileBytes, targetChannel.Id, oldFileInfo.Name)
				if appErr != nil {
					return nil, errors.Wrap(appErr, "unable to re-upload file")
				}

				newFileIDs = append(newFileIDs, newFileInfo.Id)
			}

			post.FileIds = newFileIDs
		}
	}

	for i, post := range wpl.Posts {
		var reactions []*model.Reaction

		// Store reactions to be reapplied later.
		reactions, appErr = p.API.GetReactions(post.Id)
		if appErr != nil {
			// Reaction-based errors are logged, but do not cause the plugin to
			// abort the move thread process.
			p.API.LogError("Failed to get reactions on original post", "err", appErr)
		}

		newPost := post.Clone()
		cleanPost(newPost)
		newPost.ChannelId = targetChannel.Id

		if i == 0 {
			newPost, err = p.createPostWithRetries(newPost, 200*time.Millisecond, 3)
			if err != nil {
				return nil, errors.Wrap(err, "unable to create new root post")
			}
			newRootPost = newPost.Clone()
		} else {
			newPost.RootId = newRootPost.Id
			newPost, err = p.createPostWithRetries(newPost, 200*time.Millisecond, 3)
			if err != nil {
				return nil, errors.Wrap(err, "unable to create new post")
			}
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

	return newRootPost, nil
}

func (p *Plugin) createPostWithRetries(post *model.Post, retryDuration time.Duration, maxRetries int) (*model.Post, error) {
	var retries int

	for {
		newPost, appErr := p.createPostForUser(post)
		if appErr == nil {
			return newPost, nil
		}
		p.API.LogWarn("Failed to create post", "err", appErr)

		retries++
		if retries > maxRetries {
			return nil, errors.Errorf("failed to create post after %d retries", maxRetries)
		}

		time.Sleep(retryDuration)
	}
}

func (p *Plugin) createPostForUser(post *model.Post) (*model.Post, *model.AppError) {
	post.AddProp(wrangerProp, true)
	return p.API.CreatePost(post)
}

func getRootPostFromPostList(postList *model.PostList) *model.Post {
	if len(postList.Posts) == 0 {
		return nil
	}

	postList.UniqueOrder()
	postList.SortByCreateAt()
	slice := postList.ToSlice()

	return slice[len(slice)-1]
}
