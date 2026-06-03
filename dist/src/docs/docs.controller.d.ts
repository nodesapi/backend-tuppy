import type { Request, Response } from 'express';
export declare class DocsController {
    private renderLoginHtml;
    getLoginPage(req: Request, res: Response): void | Response<any, Record<string, any>>;
    postLogin(body: any, res: Response): void | Response<any, Record<string, any>>;
    logout(res: Response): void;
}
