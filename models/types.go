package models

import (
	"time"
)

type TodoItem struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	DueDate   time.Time `json:"due_date" ts_type:"string"`
	Completed bool      `json:"completed"`
	Deleted   bool      `json:"deleted"`
	CreatedAt time.Time `json:"created_at" ts_type:"string"`
	CompletedAt *time.Time `json:"completed_at,omitempty" ts_type:"string"`
	ReminderDays int    `json:"reminder_days"` // Days before due to remind (override global if needed, or primary)
}

type AppConfig struct {
	ThemeColor       string  `json:"theme_color"`      // Hex code
	FloatingOpacity  float64 `json:"floating_opacity"` // 0.1 to 1.0
	CustomIconPath   string  `json:"custom_icon_path"` // Path to png
	EdgeLightColor   string  `json:"edge_light_color"` // Normal state border color (optional, or use ThemeColor)
	ReminderColor    string  `json:"reminder_color"`   // Urgent state border color
	StartOnBoot      bool    `json:"start_on_boot"`
	NotificationDays int     `json:"notification_days"`  // N days before due
	FloatingBallMode string  `json:"floating_ball_mode"` // "standard" or "custom"
	WindowWidth      int     `json:"window_width"`
	WindowHeight     int     `json:"window_height"`
}

const (
	ModeStandard = "standard"
	ModeCustom   = "custom"
)

func DefaultConfig() AppConfig {
	return AppConfig{
		ThemeColor:       "#2ecc71",
		FloatingOpacity:  1.0,
		EdgeLightColor:   "#2ecc71",
		ReminderColor:    "#e74c3c",
		StartOnBoot:      false,
		FloatingBallMode: ModeStandard,
		WindowWidth:      1080,
		WindowHeight:     720,
	}
}
