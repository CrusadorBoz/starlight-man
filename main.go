// Server for Starlight Man. The game is TypeScript (src/, compiled to
// assets/js/) and runs in the player's browser, so this program only hands out
// files: no sessions, no cookies, nothing stored.
//
// It sits behind nginx at /goapp/starlight-man/. nginx strips that prefix, so
// this server sees plain paths like "/" and "/js/app.js".
package main

import (
	"bytes"
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

const defaultAddr = "127.0.0.1:8091"

//go:embed assets
var assets embed.FS

type file struct {
	body []byte
	mime string
	etag string
}

const (
	html = "text/html; charset=utf-8"
	css  = "text/css; charset=utf-8"
	js   = "text/javascript; charset=utf-8"
	svg  = "image/svg+xml"
)

// pages maps each public path to its file. Nothing else is served.
var pages = map[string]struct{ name, mime string }{
	"/":                {"index.html", html},
	"/styles.css":      {"styles.css", css},
	"/icon.svg":        {"icon.svg", svg},
	"/js/app.js":       {"js/app.js", js},
	"/js/audio.js":     {"js/audio.js", js},
	"/js/creatures.js": {"js/creatures.js", js},
	"/js/foes.js":      {"js/foes.js", js},
	"/js/game.js":      {"js/game.js", js},
	"/js/maths.js":     {"js/maths.js", js},
	"/js/maze.js":      {"js/maze.js", js},
	"/js/paint.js":     {"js/paint.js", js},
	"/js/render.js":    {"js/render.js", js},
	"/js/sky.js":       {"js/sky.js", js},
	"/js/types.js":     {"js/types.js", js},
}

func load() (map[string]*file, error) {
	out := map[string]*file{}
	for path, p := range pages {
		b, err := assets.ReadFile("assets/" + p.name)
		if err != nil {
			return nil, err
		}
		sum := sha256.Sum256(b)
		out[path] = &file{body: b, mime: p.mime, etag: `"` + hex.EncodeToString(sum[:8]) + `"`}
	}
	return out, nil
}

func handler(files map[string]*file) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { fmt.Fprintln(w, "ok") })
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		f := files[r.URL.Path]
		if f == nil {
			http.NotFound(w, r)
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "GET only", http.StatusMethodNotAllowed)
			return
		}
		h := w.Header()
		h.Set("Content-Type", f.mime)
		// Always check for a new version; an unchanged file costs one 304.
		h.Set("Cache-Control", "no-cache")
		h.Set("ETag", f.etag)
		http.ServeContent(w, r, "", time.Time{}, bytes.NewReader(f.body))
	})
	return mux
}

func main() {
	files, err := load()
	if err != nil {
		log.Fatal(err)
	}
	addr := defaultAddr
	if a := os.Getenv("STARLIGHT_MAN_ADDR"); a != "" {
		addr = a
	}
	srv := &http.Server{
		Addr:              addr,
		Handler:           handler(files),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	log.Printf("starlight-man listening on %s", addr)
	log.Fatal(srv.ListenAndServe())
}
