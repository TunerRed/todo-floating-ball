package storage

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"
	"todo-ball-wails/models"
)

const (
	DataFileName   = "todos.json"
	ConfigFileName = "config.json"
)

type Storage struct {
	mu     sync.RWMutex
	Todos  []models.TodoItem
	Config models.AppConfig
	AppDir string
}

func NewStorage() (*Storage, error) {
	// Get executable dir
	exe, err := os.Executable()
	if err != nil {
		return nil, err
	}
	dir := filepath.Dir(exe)

	s := &Storage{
		AppDir: dir,
		Config: models.DefaultConfig(),
		Todos:  []models.TodoItem{},
	}

	s.LoadConfig()
	s.LoadTodos()

	return s, nil
}

func (s *Storage) LoadTodos() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	path := filepath.Join(s.AppDir, DataFileName)
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return nil
	}

	var data []byte
	var err error

	// Retry loop for file locking
	for i := 0; i < 5; i++ {
		data, err = os.ReadFile(path)
		if err == nil {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}

	if err != nil {
		return err
	}

	return json.Unmarshal(data, &s.Todos)
}

func (s *Storage) SaveTodos() error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.saveTodosLocked()
}

func (s *Storage) saveTodosLocked() error {
	data, err := json.MarshalIndent(s.Todos, "", "  ")
	if err != nil {
		return err
	}

	path := filepath.Join(s.AppDir, DataFileName)
	return os.WriteFile(path, data, 0644)
}

func (s *Storage) LoadConfig() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	path := filepath.Join(s.AppDir, ConfigFileName)
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return nil
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	return json.Unmarshal(data, &s.Config)
}

func (s *Storage) SaveConfig() error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.saveConfigLocked()
}

func (s *Storage) saveConfigLocked() error {
	data, err := json.MarshalIndent(s.Config, "", "  ")
	if err != nil {
		return err
	}

	path := filepath.Join(s.AppDir, ConfigFileName)
	return os.WriteFile(path, data, 0644)
}

func (s *Storage) AddTodo(item models.TodoItem) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Todos = append(s.Todos, item)
	return s.saveTodosLocked()
}

func (s *Storage) UpdateTodo(item models.TodoItem) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, t := range s.Todos {
		if t.ID == item.ID {
			s.Todos[i] = item
			break
		}
	}
	return s.saveTodosLocked()
}

// ToggleTodo toggles the completed status of a todo item
func (s *Storage) ToggleTodo(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i, t := range s.Todos {
		if t.ID == id {
			s.Todos[i].Completed = !s.Todos[i].Completed
			s.Todos[i].CompletedAt = nil
			if s.Todos[i].Completed {
				now := time.Now()
				s.Todos[i].CompletedAt = &now
			}
			break
		}
	}
	// We should save after modification
	return s.saveTodosLocked()
}

func (s *Storage) DeleteTodo(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	newTodos := []models.TodoItem{}
	for _, t := range s.Todos {
		if t.ID != id {
			newTodos = append(newTodos, t)
		}
	}
	s.Todos = newTodos
	return s.saveTodosLocked()
}

func (s *Storage) GetTodos() []models.TodoItem {
	s.mu.RLock()
	defer s.mu.RUnlock()
	// Return copy
	todos := make([]models.TodoItem, len(s.Todos))
	copy(todos, s.Todos)
	return todos
}

func (s *Storage) UpdateConfig(cfg models.AppConfig) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Config = cfg
	return s.saveConfigLocked()
}
