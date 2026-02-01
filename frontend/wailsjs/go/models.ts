export namespace models {
	
	export class AppConfig {
	    theme_color: string;
	    floating_opacity: number;
	    custom_icon_path: string;
	    edge_light_color: string;
	    reminder_color: string;
	    start_on_boot: boolean;
	    notification_days: number;
	    floating_ball_mode: string;
	    window_width: number;
	    window_height: number;
	
	    static createFrom(source: any = {}) {
	        return new AppConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.theme_color = source["theme_color"];
	        this.floating_opacity = source["floating_opacity"];
	        this.custom_icon_path = source["custom_icon_path"];
	        this.edge_light_color = source["edge_light_color"];
	        this.reminder_color = source["reminder_color"];
	        this.start_on_boot = source["start_on_boot"];
	        this.notification_days = source["notification_days"];
	        this.floating_ball_mode = source["floating_ball_mode"];
	        this.window_width = source["window_width"];
	        this.window_height = source["window_height"];
	    }
	}
	export class TodoItem {
	    id: string;
	    title: string;
	    due_date: string;
	    completed: boolean;
	    deleted: boolean;
	    created_at: string;
	    completed_at?: string;
	    reminder_days: number;
	
	    static createFrom(source: any = {}) {
	        return new TodoItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.due_date = source["due_date"];
	        this.completed = source["completed"];
	        this.deleted = source["deleted"];
	        this.created_at = source["created_at"];
	        this.completed_at = source["completed_at"];
	        this.reminder_days = source["reminder_days"];
	    }
	}

}

