package main

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
)

const aiPluginPostProp = "activate_ai"

func makePostLink(siteURL, teamName, postID string) string {
	return fmt.Sprintf("%s/%s/pl/%s", siteURL, teamName, postID)
}

func makeBotDM(base, newPostLink, executor string) string {
	message := cleanMessageJSON(base)
	message = strings.ReplaceAll(message, "{executor}", executor)
	message = strings.ReplaceAll(message, "{postLink}", newPostLink)

	return message
}

func cleanPost(post *model.Post) {
	post.Id = ""
	post.CreateAt = 0
	post.UpdateAt = 0
	post.EditAt = 0

	// Remove post props of other plugins where unintended behavior may occur.
	if post.GetProp(aiPluginPostProp) != nil {
		post.DelProp(aiPluginPostProp)
	}
}

func cleanPostID(post *model.Post) {
	post.Id = ""
}

func cleanAndTrimMessage(message string, trimLength int) string {
	return trimMessage(cleanMessage(message), trimLength)
}

func cleanMessage(message string) string {
	// Remove any leading whitespace and header markdown.
	message = strings.TrimLeft(message, " ")
	message = strings.TrimLeft(message, "#")
	message = strings.TrimLeft(message, " ")

	// Remove all code block markdown.
	message = strings.ReplaceAll(message, "```", "")

	// Replace all newlines to keep summary condensed.
	message = strings.ReplaceAll(message, "\n", " | ")

	return message
}

func cleanMessageJSON(message string) string {
	message = strings.TrimLeft(message, " ")
	message = strings.ReplaceAll(message, "\\n", "\n")
	return message
}

func trimMessage(message string, trimLength int) string {
	if len(message) <= trimLength {
		return message
	}

	return fmt.Sprintf("%s...", message[:trimLength])
}

func codeBlock(in string) string {
	return fmt.Sprintf("```\n%s\n```", in)
}

func quoteBlock(in string) string {
	return fmt.Sprintf("> %s", in)
}

// NewBool returns a pointer to a given bool.
func NewBool(b bool) *bool { return &b }

// NewInt returns a pointer to a given int.
func NewInt(n int) *int { return &n }

// NewInt32 returns a pointer to a given int32.
func NewInt32(n int32) *int32 { return &n }

// NewInt64 returns a pointer to a given int64.
func NewInt64(n int64) *int64 { return &n }

// NewString returns a pointer to a given string.
func NewString(s string) *string { return &s }

var pathRegex = regexp.MustCompile(`/([a-zA-Z0-9\-_]+)/pl/([a-zA-Z0-9]{26})?$`)

// getMessageIDFromLink will return the message ID of a properly formatted
// message link or the original input value if there is no match.
func getMessageIDFromLink(input, siteURL string) string {
	if !strings.HasPrefix(input, siteURL) {
		return input
	}
	path := strings.TrimPrefix(input, siteURL)
	if !pathRegex.MatchString(path) {
		return input
	}
	matches := pathRegex.FindStringSubmatch(path)
	if len(matches) < 3 {
		return input
	}

	return matches[2]
}

func cleanInputID(input, siteURL string) string {
	return getMessageIDFromLink(input, siteURL)
}
