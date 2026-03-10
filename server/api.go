package main

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/plugin"
)

const (
	// API V1
	routeAPISettings = "/api/v1/settings"

	routeProfileImage = "/profile.png"
)

func (p *Plugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
	status, err := p.serveHTTP(c, w, r)
	if err != nil {
		p.API.LogError("ERROR: ", "Status", strconv.Itoa(status), "Error", err.Error(), "Host", r.Host, "RequestURI", r.RequestURI, "Method", r.Method, "query", r.URL.Query().Encode())
	}
}

// ServeHTTP handles HTTP requests to the plugin.
func (p *Plugin) serveHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) (int, error) {
	config := p.getConfiguration()

	err := config.IsValid()
	if err != nil {
		return respondErr(w, http.StatusNotImplemented, errors.New("This plugin is not configured"))
	}

	switch path := r.URL.Path; path {
	case routeAPISettings:
		return p.handleRouteAPISettings(w, r)
	case routeProfileImage:
		return p.handleProfileImage(w, r)
	}

	return respondErr(w, http.StatusNotFound, errors.New("not found"))
}

func (p *Plugin) handleRouteAPISettings(w http.ResponseWriter, r *http.Request) (int, error) {
	if r.Method != http.MethodGet {
		return respondErr(w, http.StatusMethodNotAllowed,
			errors.Errorf("method %s is not allowed, must be GET", r.Method))
	}

	mattermostUserID := r.Header.Get("Mattermost-User-Id")
	if mattermostUserID == "" {
		return respondErr(w, http.StatusUnauthorized, errors.New("not authorized"))
	}

	var webEnabled, mergeThreadEnabled bool
	if p.getConfiguration().EnableWebUI && p.authorizedPluginUser(mattermostUserID) {
		webEnabled = true
		mergeThreadEnabled = p.getConfiguration().MergeThreadEnable
	}

	return respondJSON(w,
		struct {
			EnableWebUI       bool `json:"enable_web_ui"`
			EnableMergeThread bool `json:"enable_merge_thread"`
		}{
			EnableWebUI:       webEnabled,
			EnableMergeThread: mergeThreadEnabled,
		},
	)
}

func (p *Plugin) handleProfileImage(w http.ResponseWriter, r *http.Request) (int, error) {
	bundlePath, err := p.API.GetBundlePath()
	if err != nil {
		p.API.LogError("Unable to get bundle path, err=" + err.Error())
		return respondErr(w, http.StatusInternalServerError, errors.New("internal error"))
	}

	img, err := os.Open(filepath.Join(bundlePath, "assets", "profile.png"))
	if err != nil {
		p.API.LogError("Unable to read profile image, err=" + err.Error())
		return respondErr(w, http.StatusInternalServerError, errors.New("internal error"))
	}
	defer img.Close()

	w.Header().Set("Content-Type", "image/png")
	io.Copy(w, img)

	return http.StatusOK, nil
}

func respondErr(w http.ResponseWriter, code int, err error) (int, error) {
	http.Error(w, err.Error(), code)
	return code, err
}

func respondJSON(w http.ResponseWriter, obj interface{}) (int, error) {
	data, err := json.Marshal(obj)
	if err != nil {
		return respondErr(w, http.StatusInternalServerError, errors.WithMessage(err, "failed to marshal response"))
	}

	w.Header().Set("Content-Type", "application/json")
	_, err = w.Write(data)
	if err != nil {
		return http.StatusInternalServerError, errors.WithMessage(err, "failed to write response")
	}

	return http.StatusOK, nil
}
