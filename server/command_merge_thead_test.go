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

func TestMergeThreadCommand(t *testing.T) {
	team1 := &model.Team{
		Id:   model.NewId(),
		Name: "team-1",
	}
	originalChannel := &model.Channel{
		Id:     model.NewId(),
		TeamId: team1.Id,
		Name:   "original-channel",
		Type:   model.ChannelTypeOpen,
	}
	privateChannel := &model.Channel{
		Id:     model.NewId(),
		TeamId: team1.Id,
		Name:   "private-channel",
		Type:   model.ChannelTypePrivate,
	}
	directChannel := &model.Channel{
		Id:     model.NewId(),
		TeamId: team1.Id,
		Name:   "direct-channel",
		Type:   model.ChannelTypeDirect,
	}
	groupChannel := &model.Channel{
		Id:     model.NewId(),
		TeamId: team1.Id,
		Name:   "group-channel",
		Type:   model.ChannelTypeGroup,
	}

	targetTeam := &model.Team{
		Id:   model.NewId(),
		Name: "target-team",
	}
	targetChannel := &model.Channel{
		Id:     model.NewId(),
		TeamId: targetTeam.Id,
		Name:   "target-channel",
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
			SiteURL: NewString("test.sampledomain.com"),
		},
	}

	generatedTargetPosts := mockGeneratePostList(3, targetChannel.Id, false)
	generatedOriginalPosts := mockGeneratePostList(3, originalChannel.Id, false)
	generatedPrivatePosts := mockGeneratePostList(3, privateChannel.Id, false)
	generatedDirectPosts := mockGeneratePostList(3, directChannel.Id, false)
	generatedGroupPosts := mockGeneratePostList(3, groupChannel.Id, false)
	oldGeneratedPosts := mockGeneratePostList(3, targetChannel.Id, false)
	generatedTargetByLinkPosts := mockGeneratePostList(3, targetChannel.Id, false)
	for k := range oldGeneratedPosts.Posts {
		oldGeneratedPosts.Posts[k].CreateAt = 10
	}

	targetPostID := generatedTargetPosts.ToSlice()[0].Id
	originalPostID := generatedOriginalPosts.ToSlice()[0].Id
	privatePostID := generatedPrivatePosts.ToSlice()[0].Id
	directPostID := generatedDirectPosts.ToSlice()[0].Id
	groupPostID := generatedGroupPosts.ToSlice()[0].Id
	oldPostID := oldGeneratedPosts.ToSlice()[0].Id
	targetByLinkPostID := generatedTargetByLinkPosts.ToSlice()[0].Id

	api := &plugintest.API{}

	api.On("GetChannel", originalChannel.Id).Return(originalChannel, nil)
	api.On("GetChannel", privateChannel.Id).Return(privateChannel, nil)
	api.On("GetChannel", directChannel.Id).Return(directChannel, nil)
	api.On("GetChannel", groupChannel.Id).Return(groupChannel, nil)
	api.On("GetChannel", targetChannel.Id).Return(targetChannel, nil)
	api.On("GetChannel", oldPostID).Return(targetChannel, nil)
	api.On("GetChannel", targetByLinkPostID).Return(targetChannel, nil)

	api.On("GetPostThread", originalPostID).Return(generatedOriginalPosts, nil)
	api.On("GetPostThread", privatePostID).Return(generatedPrivatePosts, nil)
	api.On("GetPostThread", directPostID).Return(generatedDirectPosts, nil)
	api.On("GetPostThread", groupPostID).Return(generatedGroupPosts, nil)
	api.On("GetPostThread", targetPostID).Return(generatedTargetPosts, nil)
	api.On("GetPostThread", oldPostID).Return(oldGeneratedPosts, nil)
	api.On("GetPostThread", targetByLinkPostID).Return(generatedTargetByLinkPosts, nil)

	api.On("GetChannelMember", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(mockGenerateChannelMember(), nil)
	api.On("GetTeam", mock.AnythingOfType("string")).Return(targetTeam, nil)
	api.On("GetUser", mock.AnythingOfType("string")).Return(executor, nil)
	api.On("CreatePost", mock.Anything).Return(mockGeneratePost(), nil)
	api.On("DeletePost", mock.AnythingOfType("string")).Return(nil)
	api.On("GetReactions", mock.AnythingOfType("string")).Return(reactions, nil)
	api.On("AddReaction", mock.Anything).Return(nil, nil)
	api.On("GetConfig").Return(config)
	api.On("LogInfo",
		mock.AnythingOfType("string"),
		mock.AnythingOfType("string"),
		mock.AnythingOfType("string"),
		mock.AnythingOfType("string"),
		mock.AnythingOfType("string"),
		mock.AnythingOfType("string"),
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

	t.Run("not enabled", func(t *testing.T) {
		resp, isUserError, err := plugin.runMergeThreadCommand([]string{originalPostID, targetPostID}, &model.CommandArgs{ChannelId: originalChannel.Id})
		require.NoError(t, err)
		assert.True(t, isUserError)
		assert.Contains(t, resp.Text, "Merge thread command is not enabled")
	})

	plugin.setConfiguration(&configuration{MergeThreadEnable: true})
	require.NoError(t, plugin.configuration.IsValid())

	t.Run("no args", func(t *testing.T) {
		resp, isUserError, err := plugin.runMergeThreadCommand([]string{}, &model.CommandArgs{ChannelId: originalChannel.Id})
		require.NoError(t, err)
		assert.True(t, isUserError)
		assert.Contains(t, resp.Text, "Error: missing arguments")
	})

	t.Run("one arg", func(t *testing.T) {
		resp, isUserError, err := plugin.runMergeThreadCommand([]string{originalPostID}, &model.CommandArgs{ChannelId: originalChannel.Id})
		require.NoError(t, err)
		assert.True(t, isUserError)
		assert.Contains(t, resp.Text, "Error: missing arguments")
	})

	t.Run("private channel", func(t *testing.T) {
		t.Run("disabled", func(t *testing.T) {
			resp, isUserError, err := plugin.runMergeThreadCommand([]string{privatePostID, targetPostID}, &model.CommandArgs{ChannelId: privateChannel.Id})
			require.NoError(t, err)
			assert.False(t, isUserError)
			assert.Contains(t, resp.Text, "Wrangler is currently configured to not allow moving posts from private channels")
		})
	})

	t.Run("direct channel", func(t *testing.T) {
		t.Run("disabled", func(t *testing.T) {
			resp, isUserError, err := plugin.runMergeThreadCommand([]string{directPostID, targetPostID}, &model.CommandArgs{ChannelId: directChannel.Id})
			require.NoError(t, err)
			assert.False(t, isUserError)
			assert.Contains(t, resp.Text, "Wrangler is currently configured to not allow moving posts from direct message channels")
		})
	})

	t.Run("group channel", func(t *testing.T) {
		t.Run("disabled", func(t *testing.T) {
			resp, isUserError, err := plugin.runMergeThreadCommand([]string{groupPostID, targetPostID}, &model.CommandArgs{ChannelId: groupChannel.Id})
			require.NoError(t, err)
			assert.False(t, isUserError)
			assert.Contains(t, resp.Text, "Wrangler is currently configured to not allow moving posts from group message channels")
		})
	})

	t.Run("to another team", func(t *testing.T) {
		t.Run("disabled", func(t *testing.T) {
			resp, isUserError, err := plugin.runMergeThreadCommand([]string{originalPostID, targetPostID}, &model.CommandArgs{ChannelId: originalChannel.Id})
			require.NoError(t, err)
			assert.False(t, isUserError)
			assert.Contains(t, resp.Text, "Wrangler is currently configured to not allow moving messages to different teams")
		})
	})

	plugin.configuration.MoveThreadToAnotherTeamEnable = true
	require.NoError(t, plugin.configuration.IsValid())

	t.Run("merge thead into itself", func(t *testing.T) {
		resp, isUserError, err := plugin.runMergeThreadCommand([]string{originalPostID, originalPostID}, &model.CommandArgs{ChannelId: originalChannel.Id})
		require.NoError(t, err)
		assert.True(t, isUserError)
		assert.Contains(t, resp.Text, "Error: Original and target threads are the same")
	})

	t.Run("merge older thread into newer thread", func(t *testing.T) {
		resp, isUserError, err := plugin.runMergeThreadCommand([]string{oldPostID, targetPostID}, &model.CommandArgs{ChannelId: originalChannel.Id})
		require.NoError(t, err)
		assert.True(t, isUserError)
		assert.Contains(t, resp.Text, "Error: Cannot merge older threads into newer threads. The destination thread must be older than the thread being moved.")
	})

	api.On("GetChannelMember").Unset()
	originalCall := api.On("GetChannelMember", originalChannel.Id, mock.AnythingOfType("string"))
	targetCall := api.On("GetChannelMember", targetChannel.Id, mock.AnythingOfType("string"))
	originalCall.Return(nil, &model.AppError{})
	targetCall.Return(nil, &model.AppError{})

	t.Run("no original channel member", func(t *testing.T) {
		resp, isUserError, err := plugin.runMergeThreadCommand([]string{originalPostID, targetPostID}, &model.CommandArgs{ChannelId: originalChannel.Id})
		require.NoError(t, err)
		assert.True(t, isUserError)
		assert.Contains(t, resp.Text, "Error: Original Channel: Channel with ID")
	})

	originalCall.Return(nil, nil)

	t.Run("no target channel member", func(t *testing.T) {
		resp, isUserError, err := plugin.runMergeThreadCommand([]string{originalPostID, targetPostID}, &model.CommandArgs{ChannelId: originalChannel.Id})
		require.NoError(t, err)
		assert.True(t, isUserError)
		assert.Contains(t, resp.Text, "Error: Target Channel: Channel with ID")
	})

	targetCall.Return(nil, nil)

	t.Run("merge thread successfully", func(t *testing.T) {
		resp, isUserError, err := plugin.runMergeThreadCommand([]string{originalPostID, targetPostID}, &model.CommandArgs{ChannelId: originalChannel.Id})
		require.NoError(t, err)
		assert.False(t, isUserError)
		assert.Contains(t, resp.Text, "A thread with 3 message(s) has been merged")
	})

	t.Run("thread is above configuration move-maximum", func(t *testing.T) {
		plugin.configuration.MoveThreadMaxCount = "1"
		require.NoError(t, plugin.configuration.IsValid())

		resp, isUserError, err := plugin.runMergeThreadCommand([]string{originalPostID, targetPostID}, &model.CommandArgs{ChannelId: model.NewId()})
		require.NoError(t, err)
		assert.True(t, isUserError)
		assert.Contains(t, resp.Text, "Error: the thread is 3 posts long, but this command is configured to only move threads of up to 1 posts")
	})

	t.Run("merge thread by link successfully", func(t *testing.T) {
		// Reset the configuration from the previous test.
		plugin.configuration.MoveThreadMaxCount = "3"
		require.NoError(t, plugin.configuration.IsValid())

		// Create dummy-links and generate post IDs from them.
		originalPostLink := fmt.Sprintf("https://%s/%s/pl/%s", *config.ServiceSettings.SiteURL, team1.Name, originalPostID)
		targetPostLink := fmt.Sprintf("https://%s/%s/pl/%s", *config.ServiceSettings.SiteURL, team1.Name, targetByLinkPostID)
		cleanOriginalPostID := getMessageIDFromLink(originalPostLink, *config.ServiceSettings.SiteURL)
		cleanTargetPostID := getMessageIDFromLink(targetPostLink, *config.ServiceSettings.SiteURL)

		resp, isUserError, err := plugin.runMergeThreadCommand([]string{cleanOriginalPostID, cleanTargetPostID}, &model.CommandArgs{ChannelId: originalChannel.Id})
		require.NoError(t, err)
		assert.False(t, isUserError)
		assert.Contains(t, resp.Text, "A thread with 3 message(s) has been merged")
	})
}
