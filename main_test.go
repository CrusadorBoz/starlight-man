package main

import (
	"io/fs"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"
)

func get(h http.Handler, method, path, ifNoneMatch string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, path, nil)
	if ifNoneMatch != "" {
		r.Header.Set("If-None-Match", ifNoneMatch)
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func TestServesOnlyItsFiles(t *testing.T) {
	files, err := load()
	if err != nil {
		t.Fatal(err)
	}
	h := handler(files)
	for path, p := range pages {
		w := get(h, "GET", path, "")
		if w.Code != 200 || w.Header().Get("Content-Type") != p.mime || w.Body.Len() == 0 {
			t.Errorf("%s: %d %q %d bytes", path, w.Code, w.Header().Get("Content-Type"), w.Body.Len())
		}
		if w = get(h, "GET", path, w.Header().Get("ETag")); w.Code != 304 {
			t.Errorf("%s: unchanged file answered %d, want 304", path, w.Code)
		}
	}
	for _, path := range []string{"/assets/", "/index.html", "/js/", "/../main.go", "/nope", "/assets/index.html"} {
		if w := get(h, "GET", path, ""); w.Code == 200 {
			t.Errorf("%s should not be served", path)
		}
	}
	if w := get(h, "POST", "/", ""); w.Code != 405 {
		t.Errorf("POST answered %d, want 405", w.Code)
	}
}

// A new .ts file that is not in the list above would be a 404 in the browser.
func TestEveryModuleIsServed(t *testing.T) {
	names, err := fs.Glob(assets, "assets/js/*.js")
	if err != nil || len(names) == 0 {
		t.Fatal("no compiled modules: run build.sh", err)
	}
	imports := regexp.MustCompile(`from '\./([a-z]+)\.(\w+)'`)
	for _, n := range names {
		if _, ok := pages["/"+n[len("assets/"):]]; !ok {
			t.Errorf("%s is not served", n)
		}
		b, _ := assets.ReadFile(n)
		for _, m := range imports.FindAllStringSubmatch(string(b), -1) {
			if m[2] != "js" || pages["/js/"+m[1]+".js"].name == "" {
				t.Errorf("%s imports %s", n, m[0])
			}
		}
	}
}
