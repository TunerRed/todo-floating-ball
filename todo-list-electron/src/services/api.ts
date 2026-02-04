import { TodoItem, AppConfig } from '../types';

export const GetTodos = async (): Promise<TodoItem[]> => {
    return await window.ipcRenderer.invoke('get-todos');
};

export const AddTodo = async (title: string, dueDate: string, reminderDays: number): Promise<void> => {
    const item: TodoItem = {
        id: Date.now().toString(),
        title,
        completed: false,
        dueDate,
        reminderDays
    };
    await window.ipcRenderer.invoke('add-todo', item);
};

export const ToggleTodo = async (id: string): Promise<void> => {
    await window.ipcRenderer.invoke('toggle-todo', id);
};

export const DeleteTodo = async (id: string): Promise<void> => {
    await window.ipcRenderer.invoke('delete-todo', id);
};

export const GetConfig = async (): Promise<AppConfig> => {
    return await window.ipcRenderer.invoke('get-config');
};

export const UpdateConfig = async (config: AppConfig): Promise<void> => {
    await window.ipcRenderer.invoke('update-config', config);
};

export const OpenMain = async (): Promise<void> => {
    await window.ipcRenderer.invoke('open-main');
};

export const FullQuit = async (): Promise<void> => {
    await window.ipcRenderer.invoke('full-quit');
};

export const SelectFile = async (): Promise<string> => {
    return await window.ipcRenderer.invoke('select-file');
};

export const OnTodosUpdated = (callback: () => void) => {
    const listener = () => callback();
    window.ipcRenderer.on('todos-updated', listener);
    return () => window.ipcRenderer.off('todos-updated', listener);
};
