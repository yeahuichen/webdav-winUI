export namespace main {
	
	export class GlobalAuth {
	    username: string;
	    password: string;
	
	    static createFrom(source: any = {}) {
	        return new GlobalAuth(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.username = source["username"];
	        this.password = source["password"];
	    }
	}
	export class ShareMount {
	    id: number;
	    folder: string;
	    port: number;
	    status: string;
	
	    static createFrom(source: any = {}) {
	        return new ShareMount(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.folder = source["folder"];
	        this.port = source["port"];
	        this.status = source["status"];
	    }
	}

}

