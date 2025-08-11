package utils

import (
	"regexp"
	"strings"
)

// SanitizeFilename removes dangerous characters, path separators, and control chars
// to prevent header injection and path traversal. Falls back to "file" if empty.
func SanitizeFilename(name string) string {
	// Remove CR/LF and other control chars
	name = strings.Map(func(r rune) rune {
		if r < 32 || r == 127 {
			return -1
		}
		return r
	}, name)
	// Disallow path separators and backslashes
	replacer := strings.NewReplacer("/", "-", "\\", "-", "..", "-", ":", "-", "\"", "'", "<", "_", ">", "_", "|", "-")
	name = replacer.Replace(name)
	// Collapse spaces
	name = strings.TrimSpace(name)
	name = regexp.MustCompile(`\s+`).ReplaceAllString(name, " ")
	if name == "" {
		return "file"
	}
	return name
}
