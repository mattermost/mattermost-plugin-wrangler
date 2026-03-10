package main

import (
	"fmt"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestAttachMessageCommand(t *testing.T) {
	team1 := &model.Team{
		Id:   model.NewId(),
		Name: "team-1",
	}
	channel1 := &model.Channel{
		Id:     model.NewId(),
		TeamId: team1.Id,
		Name:   "channel1",
		Type:   model.ChannelTypeOpen,
	}
	postToBeAttached := &model.Post{
		Id:        model.NewId(),
		UserId:    model.NewId(),
		ChannelId: channel1.Id,
	}
	postToAttachTo := &model.Post{
		Id:        model.NewId(),
		UserId:    model.NewId(),
		ChannelId: channel1.Id,
	}
	postToBeAttachedByLink := &model.Post{
		Id:        model.NewId(),
		UserId:    model.NewId(),
		ChannelId: channel1.Id,
	}
	postToAttachToByLink := &model.Post{
		Id:        model.NewId(),
		UserId:    model.NewId(),
		ChannelId: channel1.Id,
	}
	rootID := model.NewId()
	postInThreadAlready := &model.Post{
		Id:        model.NewId(),
		ChannelId: channel1.Id,
		RootId:    rootID,
	}
	postInAnotherChannel := &model.Post{
		Id:        model.NewId(),
		ChannelId: model.NewId(),
	}
	directChannel := &model.Channel{
		Id:     model.NewId(),
		TeamId: team1.Id,
		Name:   "direct1",
		Type:   model.ChannelTypeDirect,
	}
	currentTeam := &model.Team{
		Id:   model.NewId(),
		Name: "target-team",
	}

	reactions := []*model.Reaction{
		{
			UserId: model.NewId(),
			PostId: model.NewId(),
		},
	}

	executor := &model.User{
		Nickname: "executing user",
	}

	config := &model.Config{
		ServiceSettings: model.ServiceSettings{
			SiteURL: NewString("https://test.sampledomain.com"),
		},
	}

	api := &plugintest.API{}
	api.On("GetPost", postToBeAttached.Id).Return(postToBeAttached, nil)
	api.On("GetPost", postToAttachTo.Id).Return(postToAttachTo, nil)
	api.On("GetPost", postToBeAttachedByLink.Id).Return(postToBeAttachedByLink, nil)
	api.On("GetPost", postToAttachToByLink.Id).Return(postToAttachToByLink, nil)
	api.On("GetPost", postInThreadAlready.Id).Return(postInThreadAlready, nil)
	api.On("GetPost", postInAnotherChannel.Id).Return(postInAnotherChannel, nil)
	api.On("GetPost", mock.AnythingOfType("string"), mock.Anything, mock.Anything).Return(nil, model.NewAppError("where", model.NewId(), nil, "not found", 0))
	api.On("CreatePost", mock.Anything, mock.Anything).Return(mockGeneratePost(), nil)
	api.On("DeletePost", mock.AnythingOfType("string"), mock.Anything, mock.Anything).Return(nil)
	api.On("GetDirectChannel", mock.AnythingOfType("string"), mock.Anything, mock.Anything).Return(directChannel, nil)
	api.On("GetReactions", mock.AnythingOfType("string")).Return(reactions, nil)
	api.On("AddReaction", mock.Anything).Return(nil, nil)
	api.On("GetTeam", mock.AnythingOfType("string"), mock.Anything, mock.Anything).Return(currentTeam, nil)
	api.On("GetUser", mock.Anything).Return(executor, nil)
	api.On("GetConfig", mock.Anything).Return(config)
	api.On("LogInfo",
		mock.AnythingOfType("string"),
		mock.AnythingOfType("string"),
		mock.AnythingOfType("string"),
		mock.AnythingOfType("string"),
		mock.AnythingOfType("string"),
		mock.AnythingOfType("string"),
		mock.AnythingOfType("string"),
	).Return(nil)
	api.On("LogError",
		mock.AnythingOfType("string"),
		mock.AnythingOfType("string"),
		mock.AnythingOfType("string"),
		mock.AnythingOfType("string"),
		mock.AnythingOfType("string"),
		mock.AnythingOfType("string"),
		mock.AnythingOfType("string"),
	).Return(nil)

	var plugin Plugin
	plugin.SetAPI(api)

	t.Run("no args", func(t *testing.T) {
		resp, isUserError, err := plugin.runAttachMessageCommand([]string{}, &model.CommandArgs{ChannelId: channel1.Id})
		require.NoError(t, err)
		assert.True(t, isUserError)
		assert.Contains(t, resp.Text, "Error: missing arguments")
	})

	t.Run("one arg", func(t *testing.T) {
		resp, isUserError, err := plugin.runAttachMessageCommand([]string{"id1"}, &model.CommandArgs{ChannelId: channel1.Id})
		require.NoError(t, err)
		assert.True(t, isUserError)
		assert.Contains(t, resp.Text, "Error: missing arguments")
	})

	t.Run("post IDs are the same", func(t *testing.T) {
		resp, isUserError, err := plugin.runAttachMessageCommand([]string{postToAttachTo.Id, postToAttachTo.Id}, &model.CommandArgs{ChannelId: model.NewId()})
		require.NoError(t, err)
		assert.True(t, isUserError)
		assert.Contains(t, resp.Text, "Error: the two provided message IDs should not be the same")
	})

	t.Run("post to be attached invalid", func(t *testing.T) {
		resp, isUserError, err := plugin.runAttachMessageCommand([]string{model.NewId(), postToAttachTo.Id}, &model.CommandArgs{ChannelId: model.NewId()})
		require.NoError(t, err)
		assert.True(t, isUserError)
		assert.Contains(t, resp.Text, "Error: unable to get message with ID")
	})

	t.Run("post to be attached to invalid", func(t *testing.T) {
		resp, isUserError, err := plugin.runAttachMessageCommand([]string{postToBeAttached.Id, model.NewId()}, &model.CommandArgs{ChannelId: model.NewId()})
		require.NoError(t, err)
		assert.True(t, isUserError)
		assert.Contains(t, resp.Text, "Error: unable to get message with ID")
	})

	t.Run("invalid command run location", func(t *testing.T) {
		t.Run("not in channel with messages", func(t *testing.T) {
			resp, isUserError, err := plugin.runAttachMessageCommand([]string{postToBeAttached.Id, postToAttachTo.Id}, &model.CommandArgs{ChannelId: model.NewId()})
			require.NoError(t, err)
			assert.True(t, isUserError)
			assert.Contains(t, resp.Text, "Error: the attach command must be run from the channel containing the messages")
		})

		t.Run("in thread with message to be attached", func(t *testing.T) {
			t.Run("parentId matches", func(t *testing.T) {
				resp, isUserError, err := plugin.runAttachMessageCommand([]string{postToBeAttached.Id, postToAttachTo.Id}, &model.CommandArgs{ChannelId: channel1.Id, ParentId: postToBeAttached.Id})
				require.NoError(t, err)
				assert.True(t, isUserError)
				assert.Contains(t, resp.Text, "Error: the 'attach message' command cannot be run from inside the thread of the message being attached; please run directly in the channel containing the message you wish to attach")
			})

			t.Run("rootId matches", func(t *testing.T) {
				resp, isUserError, err := plugin.runAttachMessageCommand([]string{postToBeAttached.Id, postToAttachTo.Id}, &model.CommandArgs{ChannelId: channel1.Id, RootId: postToBeAttached.Id})
				require.NoError(t, err)
				assert.True(t, isUserError)
				assert.Contains(t, resp.Text, "Error: the 'attach message' command cannot be run from inside the thread of the message being attached; please run directly in the channel containing the message you wish to attach")
			})
		})
	})

	t.Run("attach to message in another channel", func(t *testing.T) {
		resp, isUserError, err := plugin.runAttachMessageCommand([]string{postToBeAttached.Id, postInAnotherChannel.Id}, &model.CommandArgs{ChannelId: channel1.Id})
		require.NoError(t, err)
		assert.True(t, isUserError)
		assert.Contains(t, resp.Text, "Error: unable to attach message to a thread in another channel")
	})

	t.Run("attach message already in another thread", func(t *testing.T) {
		resp, isUserError, err := plugin.runAttachMessageCommand([]string{postInThreadAlready.Id, postToAttachTo.Id}, &model.CommandArgs{ChannelId: channel1.Id})
		require.NoError(t, err)
		assert.True(t, isUserError)
		assert.Contains(t, resp.Text, "Error: the message to be attached is already part of a thread")
	})

	t.Run("attach message successfully", func(t *testing.T) {
		plugin.setConfiguration(&configuration{MoveThreadToAnotherTeamEnable: true})
		require.NoError(t, plugin.configuration.IsValid())

		resp, isUserError, err := plugin.runAttachMessageCommand([]string{postToBeAttached.Id, postToAttachTo.Id}, &model.CommandArgs{ChannelId: channel1.Id})
		require.NoError(t, err)
		assert.False(t, isUserError)
		assert.Contains(t, resp.Text, "Message successfully attached to thread")
	})

	t.Run("attach posts by their message links successfully", func(t *testing.T) {
		plugin.setConfiguration(&configuration{MoveThreadToAnotherTeamEnable: true})
		require.NoError(t, plugin.configuration.IsValid())

		postToBeAttachedLink := fmt.Sprintf("%s/%s/pl/%s", *config.ServiceSettings.SiteURL, team1.Name, postToBeAttachedByLink.Id)
		postToAttachToLink := fmt.Sprintf("%s/%s/pl/%s", *config.ServiceSettings.SiteURL, team1.Name, postToAttachToByLink.Id)
		postToBeAttachedID := getMessageIDFromLink(postToBeAttachedLink, *config.ServiceSettings.SiteURL)
		postToAttachToID := getMessageIDFromLink(postToAttachToLink, *config.ServiceSettings.SiteURL)

		resp, isUserError, err := plugin.runAttachMessageCommand([]string{postToBeAttachedID, postToAttachToID}, &model.CommandArgs{ChannelId: channel1.Id})
		require.NoError(t, err)
		assert.False(t, isUserError)
		assert.Contains(t, resp.Text, "Message successfully attached to thread")
	})
}
