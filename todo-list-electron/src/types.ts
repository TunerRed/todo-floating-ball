export interface TodoItem {
    id: string;
    title: string;
    completed: boolean;
    dueDate: string;
    reminderDays: number;
}

export interface AppConfig {
    startOnBoot: boolean;
    windowWidth: number;
    windowHeight: number;
    floatingOpacity: number;
    ballColor?: string;
    ballReminderColor?: string;
    customIconPath?: string;
    mainWindowIcon?: string;
    ballWindowIcon?: string;
    refreshInterval?: number;
}
