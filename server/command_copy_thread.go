package main

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
)

const copyThreadUsage = `/wrangler copy thread [MESSAGE_ID or MESSAGE_LINK] [CHANNEL_ID]
  Copy a given message, along with the thread it belongs to, to a given channel
    - This can be on any channel in any team that you have joined
    - Obtain the message ID by running '/wrangler list messages' or via the 'Permalink' message dropdown option (it's the last part of the URL)
    - Obtain the channel ID by running '/wrangler list channels' or via the channel 'View Info' option`

func getCopyThreadMessage() string {
	return codeBlock(fmt.Sprintf("`Error: missing arguments\n\n%s", copyThreadUsage))
}

func (p *Plugin) runCopyThreadCommand(args []string, extra *model.CommandArgs) (*model.CommandResponse, bool, error) {
	if len(args) < 2 {
		return getCommandResponse(model.CommandResponseTypeEphemeral, getCopyThreadMessage()), true, nil
	}
	postID := cleanInputID(args[0], extra.SiteURL)
	channelID := args[1]

	postListResponse, appErr := p.API.GetPostThread(postID)
	if appErr != nil {
		return getCommandResponse(model.CommandResponseTypeEphemeral, fmt.Sprintf("Error: unable to get post with ID %s; ensure this is correct", postID)), true, nil
	}
	wpl := buildWranglerPostList(postListResponse)

	originalChannel, appErr := p.API.GetChannel(extra.ChannelId)
	if appErr != nil {
		return nil, false, fmt.Errorf("unable to get channel with ID %s", extra.ChannelId)
	}
	_, appErr = p.API.GetChannelMember(channelID, extra.UserId)
	if appErr != nil {
		return getCommandResponse(model.CommandResponseTypeEphemeral, fmt.Sprintf("Error: channel with ID %s doesn't exist or you are not a member", channelID)), true, nil
	}
	targetChannel, appErr := p.API.GetChannel(channelID)
	if appErr != nil {
		return nil, false, fmt.Errorf("unable to get channel with ID %s", channelID)
	}

	response, userErr, err := p.validateMoveOrCopy(wpl, originalChannel, targetChannel, extra)
	if response != nil || err != nil {
		return response, userErr, err
	}

	targetTeam, appErr := p.API.GetTeam(targetChannel.TeamId)
	if appErr != nil {
		return nil, false, fmt.Errorf("unable to get team with ID %s", targetChannel.TeamId)
	}

	p.API.LogInfo("Wrangler is copying a thread",
		"user_id", extra.UserId,
		"original_post_id", wpl.RootPost().Id,
		"original_channel_id", originalChannel.Id,
	)

	newRootPost, err := p.copyWranglerPostlist(wpl, targetChannel)
	if err != nil {
		return nil, false, err
	}

	_, appErr = p.API.CreatePost(&model.Post{
		UserId:    p.BotUserID,
		RootId:    newRootPost.Id,
		ChannelId: targetChannel.Id,
		Message:   "This thread was copied from another channel",
	})
	if appErr != nil {
		return nil, false, errors.Wrap(appErr, "unable to create new bot post")
	}

	newPostLink := makePostLink(*p.API.GetConfig().ServiceSettings.SiteURL, targetTeam.Name, newRootPost.Id)
	_, appErr = p.API.CreatePost(&model.Post{
		UserId:    p.BotUserID,
		RootId:    wpl.RootPost().Id,
		ChannelId: originalChannel.Id,
		Message:   fmt.Sprintf("A copy of this thread has been made: %s", newPostLink),
	})
	if appErr != nil {
		return nil, false, errors.Wrap(appErr, "unable to create new bot post")
	}

	p.API.LogInfo("Wrangler thread copy complete",
		"user_id", extra.UserId,
		"new_post_id", newRootPost.Id,
		"new_channel_id", channelID,
	)

	executor, execError := p.API.GetUser(extra.UserId)
	if execError != nil {
		return nil, false, errors.Wrap(appErr, "unable to find executor")
	}

	if extra.UserId != wpl.RootPost().UserId {
		// The wrangled thread was not started by the user running the command.
		// Send a DM to the user who created the root message to let them know.
		err := p.postCopyThreadBotDM(wpl.RootPost().UserId, newPostLink, executor.Username)
		if err != nil {
			p.API.LogError("Unable to send copy-thread DM to user",
				"error", err.Error(),
				"user_id", wpl.RootPost().UserId,
			)
		}
	}

	return getCommandResponse(model.CommandResponseTypeEphemeral, "Thread copy complete"), false, nil
}

func (p *Plugin) postCopyThreadBotDM(userID, newPostLink, executor string) error {
	config := p.getConfiguration()
	message := makeBotDM(config.CopyThreadMessage, newPostLink, executor)

	return p.PostBotDM(userID, message)
}
