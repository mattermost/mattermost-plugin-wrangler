// main handles deployment of the plugin to a development server using either the Client4 API
// or by copying the plugin bundle into a sibling mattermost-server/plugin directory.
package main

import (
	"context"
	stderrors "errors"
	"fmt"
	"io"
	"io/fs"
	"log"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mholt/archives"
	"github.com/pkg/errors"
)

func main() {
	err := deploy()
	if err != nil {
		fmt.Printf("Failed to deploy: %s\n", err.Error())
		fmt.Println()
		fmt.Println("Usage:")
		fmt.Println("    deploy <plugin id> <bundle path>")
		os.Exit(1)
	}
}

func deploy() error {
	if len(os.Args) < 3 {
		return errors.New("invalid number of arguments")
	}

	pluginID := os.Args[1]
	bundlePath := os.Args[2]

	siteURL := os.Getenv("MM_SERVICESETTINGS_SITEURL")
	adminToken := os.Getenv("MM_ADMIN_TOKEN")
	adminUsername := os.Getenv("MM_ADMIN_USERNAME")
	adminPassword := os.Getenv("MM_ADMIN_PASSWORD")
	copyTargetDirectory, _ := filepath.Abs("../mattermost-server")

	if siteURL != "" {
		client := model.NewAPIv4Client(siteURL)

		if adminToken != "" {
			log.Printf("Authenticating using token against %s.", siteURL)
			client.SetToken(adminToken)

			return uploadPlugin(client, pluginID, bundlePath)
		}

		if adminUsername != "" && adminPassword != "" {
			client := model.NewAPIv4Client(siteURL)
			log.Printf("Authenticating as %s against %s.", adminUsername, siteURL)
			_, _, err := client.Login(context.Background(), adminUsername, adminPassword)
			if err != nil {
				return errors.Wrapf(err, "failed to login as %s", adminUsername)
			}

			return uploadPlugin(client, pluginID, bundlePath)
		}
	}

	_, err := os.Stat(copyTargetDirectory)
	if os.IsNotExist(err) {
		return errors.New("no supported deployment method available, please install plugin manually")
	} else if err != nil {
		return errors.Wrapf(err, "failed to stat %s", copyTargetDirectory)
	}

	log.Printf("Installing plugin to mattermost-server found in %s.", copyTargetDirectory)
	log.Print("Server restart required to load updated plugin.")
	return copyPlugin(pluginID, copyTargetDirectory, bundlePath)
}

func uploadPlugin(client *model.Client4, pluginID, bundlePath string) error {
	pluginBundle, err := os.Open(bundlePath)
	if err != nil {
		return errors.Wrapf(err, "failed to open %s", bundlePath)
	}
	defer pluginBundle.Close()

	log.Print("Uploading plugin via API.")
	_, _, err = client.UploadPluginForced(context.Background(), pluginBundle)
	if err != nil {
		return fmt.Errorf("failed to upload plugin bundle: %w", err)
	}

	log.Print("Enabling plugin.")
	_, err = client.EnablePlugin(context.Background(), pluginID)
	if err != nil {
		return fmt.Errorf("failed to enable plugin: %w", err)
	}

	return nil
}

func copyPlugin(pluginID, targetPath, bundlePath string) error {
	targetPath = filepath.Join(targetPath, "plugins")

	err := os.MkdirAll(targetPath, 0777)
	if err != nil {
		return errors.Wrapf(err, "failed to create %s", targetPath)
	}

	existingPluginPath := filepath.Join(targetPath, pluginID)
	err = os.RemoveAll(existingPluginPath)
	if err != nil {
		return errors.Wrapf(err, "failed to remove existing existing plugin directory %s", existingPluginPath)
	}

	if err := unarchiveBundle(context.Background(), bundlePath, targetPath); err != nil {
		return errors.Wrapf(err, "failed to unarchive %s into %s", bundlePath, targetPath)
	}

	return nil
}


func unarchiveBundle(ctx context.Context, bundlePath, destDir string) error {
	f, err := os.Open(bundlePath)
	if err != nil {
		return err
	}
	defer f.Close()

	format, stream, err := archives.Identify(ctx, filepath.Base(bundlePath), f)
	if err != nil {
		if stderrors.Is(err, archives.NoMatch) {
			return fmt.Errorf("unrecognized archive format for %s", bundlePath)
		}
		return err
	}

	extractor, ok := format.(archives.Extractor)
	if !ok {
		return fmt.Errorf("format %T does not support extraction", format)
	}

	destDir, err = filepath.Abs(filepath.Clean(destDir))
	if err != nil {
		return err
	}

	return extractor.Extract(ctx, stream, func(ctx context.Context, info archives.FileInfo) error {
		if err := ctx.Err(); err != nil {
			return err
		}

		if info.Mode()&fs.ModeSymlink != 0 {
			return fmt.Errorf("symlink entries are not allowed in plugin bundles (%q)", info.NameInArchive)
		}

		outPath, err := safeExtractPath(destDir, info.NameInArchive)
		if err != nil {
			return err
		}
		if outPath == "" {
			// Root or current-dir placeholder; nothing to write.
			return drainArchiveFile(info)
		}

		switch {
		case info.IsDir():
			if err := os.MkdirAll(outPath, 0o755); err != nil {
				return err
			}
			return drainArchiveFile(info)
		default:
			if err := os.MkdirAll(filepath.Dir(outPath), 0o755); err != nil {
				return err
			}
			mode := info.Mode().Perm()
			if mode == 0 {
				mode = 0o644
			}
			rc, err := info.Open()
			if err != nil {
				return err
			}
			defer rc.Close()
			out, err := os.OpenFile(outPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, mode)
			if err != nil {
				return err
			}
			defer out.Close()
			_, err = io.Copy(out, rc)
			return err
		}
	})
}

func safeExtractPath(destDir, nameInArchive string) (string, error) {
	rel := filepath.ToSlash(strings.TrimSpace(nameInArchive))
	rel = strings.TrimPrefix(rel, "/")
	if rel == "" || rel == "." {
		return "", nil
	}
	for _, part := range strings.Split(rel, "/") {
		if part == ".." {
			return "", fmt.Errorf("illegal path in archive: %q", nameInArchive)
		}
	}
	rel = strings.TrimPrefix(path.Clean("/"+rel), "/")
	if rel == "" || rel == "." {
		return "", nil
	}
	outPath := filepath.Join(destDir, filepath.FromSlash(rel))
	relOut, err := filepath.Rel(destDir, outPath)
	if err != nil || relOut == ".." || strings.HasPrefix(relOut, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("path escapes destination: %q", nameInArchive)
	}
	return outPath, nil
}

func drainArchiveFile(info archives.FileInfo) error {
	rc, err := info.Open()
	if err != nil {
		return err
	}
	defer rc.Close()
	_, err = io.Copy(io.Discard, rc)
	return err
}
