package main

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
)

func TestMakeBotDM(t *testing.T) {
	tests := []struct {
		name     string
		base     string
		postLink string
		executor string
		expected string
	}{
		{
			name:     "all empty",
			base:     "",
			postLink: "",
			executor: "",
			expected: "",
		},
		{
			name:     "base only",
			base:     "test message",
			postLink: "",
			executor: "",
			expected: "test message",
		},
		{
			name:     "no replacements",
			base:     "test message",
			postLink: "https://domain.com/path",
			executor: "user1",
			expected: "test message",
		},
		{
			name:     "replace post link only",
			base:     "test message to {postLink}",
			postLink: "https://domain.com/path",
			executor: "user1",
			expected: "test message to https://domain.com/path",
		},
		{
			name:     "replace executor only",
			base:     "test message from {executor}",
			postLink: "https://domain.com/path",
			executor: "user1",
			expected: "test message from user1",
		},
		{
			name:     "both replaced (default)",
			base:     "@{executor} wrangled a thread you started to a new channel for you: {postLink}",
			postLink: "https://domain.com/path",
			executor: "user1",
			expected: "@user1 wrangled a thread you started to a new channel for you: https://domain.com/path",
		},
		{
			name:     "multiple replace",
			base:     "User: @{executor} @{executor} @{executor} | Link: {postLink} {postLink}",
			postLink: "https://domain.com/path",
			executor: "user1",
			expected: "User: @user1 @user1 @user1 | Link: https://domain.com/path https://domain.com/path",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			message := makeBotDM(tt.base, tt.postLink, tt.executor)
			assert.Equal(t, tt.expected, message)
		})
	}
}

func TestCleanInputID(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		siteURL  string
		expected string
	}{
		{
			name:     "valid link",
			input:    "https://test.sampledomain.com/team2/pl/8w89igrsffyt3ghmwsmsgyeoqe",
			siteURL:  "https://test.sampledomain.com",
			expected: "8w89igrsffyt3ghmwsmsgyeoqe",
		},
		{
			name:     "valid link, but for another server",
			input:    "https://test.sampledomain.com/team2/pl/8w89igrsffyt3ghmwsmsgyeoqe",
			siteURL:  "https://test2.sampledomain.com",
			expected: "https://test.sampledomain.com/team2/pl/8w89igrsffyt3ghmwsmsgyeoqe",
		},
		{
			name:     "valid id",
			input:    "8w89igrsffyt3ghmwsmsgyeoqe",
			siteURL:  "https://test.sampledomain.com",
			expected: "8w89igrsffyt3ghmwsmsgyeoqe",
		},
		{
			name:     "invalid link with no path",
			input:    "https://invalid_link",
			siteURL:  "https://invalid_link",
			expected: "https://invalid_link",
		},
		{
			name:     "invalid link with partial path",
			input:    "https://invalid_linkteam2/pl/",
			siteURL:  "https://invalid_link",
			expected: "https://invalid_linkteam2/pl/",
		},
		{
			name:     "invalid link due to short ID",
			input:    "https://test.sampledomain.com/team2/pl/tooshort",
			siteURL:  "https://test.sampledomain.com",
			expected: "https://test.sampledomain.com/team2/pl/tooshort",
		},
		{
			name:     "invalid link due to long ID",
			input:    "https://test.sampledomain.com/team2/pl/toolong8w89igrsffyt3ghmwsmsgyeoqe",
			siteURL:  "https://test.sampledomain.com",
			expected: "https://test.sampledomain.com/team2/pl/toolong8w89igrsffyt3ghmwsmsgyeoqe",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, cleanInputID(tt.input, tt.siteURL))
		})
	}
}

func TestCleanPost(t *testing.T) {
	tests := []struct {
		name     string
		post     *model.Post
		expected *model.Post
	}{
		{
			name:     "empty",
			post:     &model.Post{},
			expected: &model.Post{},
		},
		{
			name:     "standard clean",
			post:     &model.Post{Id: "ID1", CreateAt: 1, UpdateAt: 2, EditAt: 3, Message: "test message", Props: model.StringInterface{"testProp": "test"}},
			expected: &model.Post{Message: "test message", Props: model.StringInterface{"testProp": "test"}},
		},
		{
			name:     "remove ai plugin post prop",
			post:     &model.Post{Id: "ID1", CreateAt: 1, UpdateAt: 2, EditAt: 3, Message: "test message", Props: model.StringInterface{"testProp": "test", aiPluginPostProp: "true"}},
			expected: &model.Post{Message: "test message", Props: model.StringInterface{"testProp": "test"}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cleanPost(tt.post)
			assert.Equal(t, tt.expected, tt.post)
		})
	}
}
