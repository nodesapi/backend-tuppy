"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocsMiddleware = void 0;
const common_1 = require("@nestjs/common");
let DocsMiddleware = class DocsMiddleware {
    use(req, res, next) {
        const session = req.cookies['tupply_docs_session'];
        if (session === process.env.JWT_SECRET) {
            next();
        }
        else {
            res.redirect('/docs/login');
        }
    }
};
exports.DocsMiddleware = DocsMiddleware;
exports.DocsMiddleware = DocsMiddleware = __decorate([
    (0, common_1.Injectable)()
], DocsMiddleware);
//# sourceMappingURL=docs.middleware.js.map