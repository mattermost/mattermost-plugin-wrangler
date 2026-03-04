package main

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestMessagelListCommand(t *testing.T) {
	testChannel := model.Channel{
		Id:   model.NewId(),
		Name: "test-channel",
	}

	testPostList := mockGeneratePostList(3, testChannel.Id, false)

	api := &plugintest.API{}
	api.On("GetPostsForChannel", mock.AnythingOfType("string"), mock.Anything, mock.Anything).Return(testPostList, nil)

	var plugin Plugin
	plugin.SetAPI(api)

	t.Run("list messages successfully", func(t *testing.T) {
		resp, isUserError, err := plugin.runListMessagesCommand([]string{}, &model.CommandArgs{ChannelId: testChannel.Id})
		require.NoError(t, err)
		assert.False(t, isUserError)
		for _, post := range testPostList.ToSlice() {
			assert.Contains(t, resp.Text, post.Id)
			assert.Contains(t, resp.Text, post.Message)
		}
	})

	t.Run("specify valid count", func(t *testing.T) {
		resp, isUserError, err := plugin.runListMessagesCommand([]string{"--count=50"}, &model.CommandArgs{ChannelId: testChannel.Id})
		require.NoError(t, err)
		assert.False(t, isUserError)
		assert.Contains(t, resp.Text, "The last 50 messages in this channel")
		for _, post := range testPostList.ToSlice() {
			assert.Contains(t, resp.Text, post.Id)
			assert.Contains(t, resp.Text, post.Message)
			assert.Contains(t, resp.Text, post.Message)
		}
	})

	t.Run("specify count that is too low", func(t *testing.T) {
		_, isUserError, err := plugin.runListMessagesCommand([]string{"--count=-1"}, &model.CommandArgs{ChannelId: testChannel.Id})
		require.Error(t, err)
		assert.True(t, isUserError)
		assert.Contains(t, err.Error(), "count (-1) must be between 1 and 100")
	})

	t.Run("specify count that is too high", func(t *testing.T) {
		_, isUserError, err := plugin.runListMessagesCommand([]string{"--count=120"}, &model.CommandArgs{ChannelId: testChannel.Id})
		require.Error(t, err)
		assert.True(t, isUserError)
		assert.Contains(t, err.Error(), "count (120) must be between 1 and 100")
	})

	t.Run("specify valid trim-length", func(t *testing.T) {
		resp, isUserError, err := plugin.runListMessagesCommand([]string{"--trim-length=60"}, &model.CommandArgs{ChannelId: testChannel.Id})
		require.NoError(t, err)
		assert.False(t, isUserError)
		assert.Contains(t, resp.Text, "The last 20 messages in this channel")
		for _, post := range testPostList.ToSlice() {
			assert.Contains(t, resp.Text, post.Id)
			assert.Contains(t, resp.Text, post.Message)
			assert.Contains(t, resp.Text, post.Message)
		}
	})

	t.Run("specify trim-length that is too low", func(t *testing.T) {
		_, isUserError, err := plugin.runListMessagesCommand([]string{"--trim-length=-1"}, &model.CommandArgs{ChannelId: testChannel.Id})
		require.Error(t, err)
		assert.True(t, isUserError)
		assert.Contains(t, err.Error(), "trim-length (-1) must be between 10 and 500")
	})

	t.Run("specify trim-length that is too high", func(t *testing.T) {
		_, isUserError, err := plugin.runListMessagesCommand([]string{"--trim-length=600"}, &model.CommandArgs{ChannelId: testChannel.Id})
		require.Error(t, err)
		assert.True(t, isUserError)
		assert.Contains(t, err.Error(), "trim-length (600) must be between 10 and 500")
	})

	t.Run("list messages successfully with system", func(t *testing.T) {
		testPostList := mockGeneratePostList(3, testChannel.Id, true)

		api := &plugintest.API{}
		api.On("GetPostsForChannel", mock.AnythingOfType("string"), mock.Anything, mock.Anything).Return(testPostList, nil)

		var plugin Plugin
		plugin.SetAPI(api)

		resp, isUserError, err := plugin.runListMessagesCommand([]string{}, &model.CommandArgs{ChannelId: testChannel.Id})
		require.NoError(t, err)
		assert.False(t, isUserError)
		assert.Contains(t, resp.Text, "[     system message     ] - <skipped>")
	})
}

func TestCleanMessage(t *testing.T) {
	tests := []struct {
		name     string
		message  string
		expected string
	}{
		{
			name:     "no cleanup needed",
			message:  "short",
			expected: "short",
		},
		{
			name:     "remove codeblock",
			message:  "```code goes here```",
			expected: "code goes here",
		},
		{
			name:     "remove newlines",
			message:  "this message \n has multiple \n newlines \n probably",
			expected: "this message  |  has multiple  |  newlines  |  probably",
		},
		{
			name:     "remove codeblock and newlines",
			message:  "this `` ` ```message \n has` ``` multiple \n newlines \n probably ` ````",
			expected: "this `` ` message  |  has`  multiple  |  newlines  |  probably ` `",
		},
		{
			name:     "exta leading whitespace",
			message:  "   message1",
			expected: "message1",
		},
		{
			name:     "header markdown",
			message:  "### message1",
			expected: "message1",
		},
		{
			name:     "extra whitespace and header markdown",
			message:  "  ### message1",
			expected: "message1",
		},
		{
			name:     "cleanup everything",
			message:  "  # this `` ` ```message \n has` ``` multiple \n newlines \n probably ` ````",
			expected: "this `` ` message  |  has`  multiple  |  newlines  |  probably ` `",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cleanedMessage := cleanMessage(tt.message)
			assert.Equal(t, tt.expected, cleanedMessage)
			assert.NotContains(t, cleanedMessage, "```")
			assert.NotContains(t, cleanedMessage, "\n")
		})
	}
}

func TestTrimMessage(t *testing.T) {
	tests := []struct {
		name    string
		message string
		want    string
	}{
		{
			name:    "short message",
			message: "short",
			want:    "short",
		},
		{
			name:    "max (50) characters",
			message: "12345678901234567890123456789012345678901234567890",
			want:    "12345678901234567890123456789012345678901234567890",
		},
		{
			name:    "max+1 (51) characters",
			message: "123456789012345678901234567890123456789012345678901",
			want:    "12345678901234567890123456789012345678901234567890...",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, trimMessage(tt.message, 50))
		})
	}
}
