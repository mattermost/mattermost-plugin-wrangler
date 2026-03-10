package main

import (
	"fmt"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestMoveThreadCommand(t *testing.T) {
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
	readOnlyChannel := &model.Channel{
		Id:     model.NewId(),
		TeamId: team1.Id,
		Name:   "read-only",
		Type:   model.ChannelTypeOpen,
	}

	targetTeam := &model.Team{
		Id:          model.NewId(),
		Name:        "target-team",
		DisplayName: "Target Team",
	}
	targetChannel := &model.Channel{
		Id:          model.NewId(),
		TeamId:      targetTeam.Id,
		Name:        "target-channel",
		DisplayName: "Target Channel",
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

	generatedPosts := mockGeneratePostList(3, originalChannel.Id, false)
	originalPostID := generatedPosts.ToSlice()[0].Id

	api := &plugintest.API{}
	api.On("GetChannel", originalChannel.Id).Return(originalChannel, nil)
	api.On("GetChannel", privateChannel.Id).Return(privateChannel, nil)
	api.On("GetChannel", directChannel.Id).Return(directChannel, nil)
	api.On("GetChannel", groupChannel.Id).Return(groupChannel, nil)
	api.On("GetChannel", readOnlyChannel.Id).Return(readOnlyChannel, nil)
	api.On("GetChannel", mock.AnythingOfType("string")).Return(targetChannel, nil)
	api.On("GetPostThread", mock.AnythingOfType("string")).Return(generatedPosts, nil)
	api.On("GetChannelMember", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(mockGenerateChannelMember(), nil)
	api.On("GetDirectChannel", mock.AnythingOfType("string"), mock.Anything).Return(directChannel, nil)
	api.On("GetTeam", mock.AnythingOfType("string")).Return(targetTeam, nil)
	api.On("GetUser", mock.Anything).Return(executor, nil)
	api.On("HasPermissionToChannel", mock.AnythingOfType("string"), readOnlyChannel.Id, mock.Anything).Return(false)
	api.On("HasPermissionToChannel", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.Anything).Return(true)
	api.On("CreatePost", mock.Anything, mock.Anything).Return(mockGeneratePost(), nil)
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
	).Return(nil)

	var plugin Plugin
	plugin.SetAPI(api)

	t.Run("no args", func(t *testing.T) {
		resp, isUserError, err := plugin.runMoveThreadCommand([]string{}, &model.CommandArgs{ChannelId: originalChannel.Id})
		require.NoError(t, err)
		assert.True(t, isUserError)
		assert.Contains(t, resp.Text, "Error: missing arguments")
	})

	t.Run("one arg", func(t *testing.T) {
		resp, isUserError, err := plugin.runMoveThreadCommand([]string{"id1"}, &model.CommandArgs{ChannelId: originalChannel.Id})
		require.NoError(t, err)
		assert.True(t, isUserError)
		assert.Contains(t, resp.Text, "Error: missing arguments")
	})

	t.Run("private channel", func(t *testing.T) {
		t.Run("disabled", func(t *testing.T) {
			plugin.setConfiguration(&configuration{MoveThreadFromPrivateChannelEnable: false})
			require.NoError(t, plugin.configuration.IsValid())

			resp, isUserError, err := plugin.runMoveThreadCommand([]string{"id1", "id2"}, &model.CommandArgs{ChannelId: privateChannel.Id})
			require.NoError(t, err)
			assert.False(t, isUserError)
			assert.Contains(t, resp.Text, "Wrangler is currently configured to not allow moving posts from private channels")
		})
	})

	t.Run("direct channel", func(t *testing.T) {
		t.Run("disabled", func(t *testing.T) {
			plugin.setConfiguration(&configuration{MoveThreadFromDirectMessageChannelEnable: false})
			require.NoError(t, plugin.configuration.IsValid())

			resp, isUserError, err := plugin.runMoveThreadCommand([]string{"id1", "id2"}, &model.CommandArgs{ChannelId: directChannel.Id})
			require.NoError(t, err)
			assert.False(t, isUserError)
			assert.Contains(t, resp.Text, "Wrangler is currently configured to not allow moving posts from direct message channels")
		})

		t.Run("enabled, move to another team disabled", func(t *testing.T) {
			plugin.setConfiguration(&configuration{
				MoveThreadFromDirectMessageChannelEnable: true,
				MoveThreadToAnotherTeamEnable:            false,
			})
			require.NoError(t, plugin.configuration.IsValid())

			resp, isUserError, err := plugin.runMoveThreadCommand([]string{directChannel.Id, "id2"}, &model.CommandArgs{ChannelId: directChannel.Id})
			require.NoError(t, err)
			assert.True(t, isUserError)
			assert.Contains(t, resp.Text, "Error: this command must be run from the channel containing the post")
		})

		t.Run("enabled, move to another team enabled", func(t *testing.T) {
			plugin.setConfiguration(&configuration{
				MoveThreadFromDirectMessageChannelEnable: true,
				MoveThreadToAnotherTeamEnable:            true,
			})
			require.NoError(t, plugin.configuration.IsValid())

			resp, isUserError, err := plugin.runMoveThreadCommand([]string{directChannel.Id, "id2"}, &model.CommandArgs{ChannelId: directChannel.Id})
			require.NoError(t, err)
			assert.True(t, isUserError)
			assert.Contains(t, resp.Text, "Error: this command must be run from the channel containing the post")
		})
	})

	t.Run("group channel", func(t *testing.T) {
		t.Run("disabled", func(t *testing.T) {
			plugin.setConfiguration(&configuration{MoveThreadFromGroupMessageChannelEnable: false})
			require.NoError(t, plugin.configuration.IsValid())

			resp, isUserError, err := plugin.runMoveThreadCommand([]string{"id1", "id2"}, &model.CommandArgs{ChannelId: groupChannel.Id})
			require.NoError(t, err)
			assert.False(t, isUserError)
			assert.Contains(t, resp.Text, "Wrangler is currently configured to not allow moving posts from group message channels")
		})

		t.Run("enabled, move to another team disabled", func(t *testing.T) {
			plugin.setConfiguration(&configuration{
				MoveThreadFromGroupMessageChannelEnable: true,
				MoveThreadToAnotherTeamEnable:           false,
			})
			require.NoError(t, plugin.configuration.IsValid())

			resp, isUserError, err := plugin.runMoveThreadCommand([]string{"id1", "id2"}, &model.CommandArgs{ChannelId: groupChannel.Id})
			require.NoError(t, err)
			assert.True(t, isUserError)
			assert.Contains(t, resp.Text, "Error: this command must be run from the channel containing the post")
		})

		t.Run("enabled, move to another team enabled", func(t *testing.T) {
			plugin.setConfiguration(&configuration{
				MoveThreadFromGroupMessageChannelEnable: true,
				MoveThreadToAnotherTeamEnable:           true,
			})
			require.NoError(t, plugin.configuration.IsValid())

			resp, isUserError, err := plugin.runMoveThreadCommand([]string{"id1", "id2"}, &model.CommandArgs{ChannelId: groupChannel.Id})
			require.NoError(t, err)
			assert.True(t, isUserError)
			assert.Contains(t, resp.Text, "Error: this command must be run from the channel containing the post")
		})
	})

	t.Run("to another team", func(t *testing.T) {
		t.Run("disabled", func(t *testing.T) {
			plugin.setConfiguration(&configuration{MoveThreadToAnotherTeamEnable: false})
			require.NoError(t, plugin.configuration.IsValid())

			resp, isUserError, err := plugin.runMoveThreadCommand([]string{"id1", "id2"}, &model.CommandArgs{ChannelId: originalChannel.Id})
			require.NoError(t, err)
			assert.False(t, isUserError)
			assert.Contains(t, resp.Text, "Wrangler is currently configured to not allow moving messages to different teams")
		})
	})

	t.Run("invalid command run location", func(t *testing.T) {
		plugin.setConfiguration(&configuration{MoveThreadToAnotherTeamEnable: true})

		t.Run("not in thread channel", func(t *testing.T) {
			resp, isUserError, err := plugin.runMoveThreadCommand([]string{"id1", "id2"}, &model.CommandArgs{ChannelId: model.NewId()})
			require.NoError(t, err)
			assert.True(t, isUserError)
			assert.Contains(t, resp.Text, "Error: this command must be run from the channel containing the post")
		})

		postSlice := generatedPosts.ToSlice()
		rootPostID := postSlice[len(postSlice)-1].Id

		t.Run("in thread being moved", func(t *testing.T) {
			t.Run("parentId matches", func(t *testing.T) {
				resp, isUserError, err := plugin.runMoveThreadCommand([]string{"id1", "id2"}, &model.CommandArgs{ChannelId: originalChannel.Id, ParentId: rootPostID})
				require.NoError(t, err)
				assert.True(t, isUserError)
				assert.Contains(t, resp.Text, "Error: this command cannot be run from inside the thread; please run directly in the channel containing the thread")
			})

			t.Run("rootId matches", func(t *testing.T) {
				resp, isUserError, err := plugin.runMoveThreadCommand([]string{"id1", "id2"}, &model.CommandArgs{ChannelId: originalChannel.Id, RootId: rootPostID})
				require.NoError(t, err)
				assert.True(t, isUserError)
				assert.Contains(t, resp.Text, "Error: this command cannot be run from inside the thread; please run directly in the channel containing the thread")
			})
		})
	})

	api.On("GetChannelMember").Unset()
	api.On("GetChannelMember", originalChannel.Id, mock.AnythingOfType("string")).Return(nil, nil)
	targetCall := api.On("GetChannelMember", targetChannel.Id, mock.AnythingOfType("string"))
	targetCall.Return(nil, &model.AppError{})

	t.Run("no target channel member", func(t *testing.T) {
		resp, isUserError, err := plugin.runMoveThreadCommand([]string{originalPostID, targetChannel.Id}, &model.CommandArgs{ChannelId: originalChannel.Id})
		require.NoError(t, err)
		assert.True(t, isUserError)
		assert.Contains(t, resp.Text, "Error: channel with ID")
	})

	targetCall.Return(nil, nil)
	api.On("GetChannelMember", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(mockGenerateChannelMember(), nil)

	t.Run("no permission to create posts in target channel", func(t *testing.T) {
		resp, isUserError, err := plugin.runMoveThreadCommand([]string{originalPostID, readOnlyChannel.Id}, &model.CommandArgs{ChannelId: originalChannel.Id})
		require.NoError(t, err)
		assert.True(t, isUserError)
		assert.Contains(t, resp.Text, "Error: you don't have permissions to create posts in channel read-only")
	})

	t.Run("move thread successfully", func(t *testing.T) {
		require.NoError(t, plugin.configuration.IsValid())

		resp, isUserError, err := plugin.runMoveThreadCommand([]string{"id1", "id2"}, &model.CommandArgs{ChannelId: originalChannel.Id})
		require.NoError(t, err)
		assert.False(t, isUserError)
		assert.Contains(t, resp.Text, fmt.Sprintf("A thread with 3 messages has been moved: %s", makePostLink(*config.ServiceSettings.SiteURL, targetTeam.Name, "")))
		assert.Contains(t, resp.Text, quoteBlock("This is message 1"))
	})

	t.Run("move thread successfully, but don't show root message", func(t *testing.T) {
		require.NoError(t, plugin.configuration.IsValid())

		resp, isUserError, err := plugin.runMoveThreadCommand([]string{"id1", "id2", "--show-root-message-in-summary=false"}, &model.CommandArgs{ChannelId: originalChannel.Id})
		require.NoError(t, err)
		assert.False(t, isUserError)
		assert.Contains(t, resp.Text, fmt.Sprintf("A thread with 3 messages has been moved: %s", makePostLink(*config.ServiceSettings.SiteURL, targetTeam.Name, "")))
		assert.NotContains(t, resp.Text, "This is message 1")
	})

	t.Run("move thread successfully, but silenced", func(t *testing.T) {
		require.NoError(t, plugin.configuration.IsValid())

		resp, isUserError, err := plugin.runMoveThreadCommand([]string{"id1", "id2", "--silent"}, &model.CommandArgs{ChannelId: originalChannel.Id})
		require.NoError(t, err)
		assert.False(t, isUserError)
		assert.Contains(t, resp.Text, fmt.Sprintf("A thread with 3 message(s) has been silently moved: %s", makePostLink(*config.ServiceSettings.SiteURL, targetTeam.Name, "")))
		assert.NotContains(t, resp.Text, "This is message 1")
	})

	t.Run("thread is above configuration move-maximum", func(t *testing.T) {
		plugin.setConfiguration(&configuration{MoveThreadMaxCount: "1"})
		require.NoError(t, plugin.configuration.IsValid())
		resp, isUserError, err := plugin.runMoveThreadCommand([]string{"id1", "id2"}, &model.CommandArgs{ChannelId: model.NewId()})
		require.NoError(t, err)
		assert.True(t, isUserError)
		assert.Contains(t, resp.Text, "Error: the thread is 3 posts long, but this command is configured to only move threads of up to 1 posts")
	})
}

func TestSortedPostsFromPostList(t *testing.T) {
	tests := []struct {
		count int
	}{
		{count: 0},
		{count: 1},
		{count: 10},
		{count: 100},
	}

	for _, tt := range tests {
		t.Run(fmt.Sprintf("%d messages", tt.count), func(t *testing.T) {
			postList := mockGeneratePostList(tt.count, model.NewId(), false)
			wpl := buildWranglerPostList(postList)

			require.Equal(t, len(postList.Posts), wpl.NumPosts())
			if wpl.NumPosts() > 0 {
				for _, post := range wpl.Posts {
					assert.NotNil(t, postList.Posts[post.Id])
				}
			}
		})
	}
}

func mockGeneratePostList(total int, channelID string, systemMessages bool) *model.PostList {
	postList := model.NewPostList()
	for i := 0; i < total; i++ {
		id := model.NewId()
		post := &model.Post{
			Id:        id,
			UserId:    model.NewId(),
			ChannelId: channelID,
			Message:   fmt.Sprintf("This is message %d", total-i),
			CreateAt:  time.Now().Unix(),
		}
		if systemMessages {
			post.Type = model.PostSystemMessagePrefix
		}
		postList.AddPost(post)
		postList.AddOrder(id)
		time.Sleep(time.Millisecond)
	}

	return postList
}

func mockGenerateChannelMember() *model.ChannelMember {
	return &model.ChannelMember{
		ChannelId: model.NewId(),
	}
}

func mockGeneratePost() *model.Post {
	return &model.Post{
		Id: model.NewId(),
	}
}
