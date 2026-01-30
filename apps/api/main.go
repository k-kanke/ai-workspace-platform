package main

import (
	"net/http"
	"os"

	"github.com/labstack/echo/v4"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	e := echo.New()
	e.HideBanner = true

	e.GET("/healthz", func(c echo.Context) error {
		return c.String(http.StatusOK, "ok")
	})

	e.GET("/", func(c echo.Context) error {
		return c.String(http.StatusOK, "ai-workspace api")
	})

	e.Logger.Fatal(e.Start(":" + port))
}
