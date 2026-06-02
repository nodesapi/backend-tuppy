"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateAnalyticsDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const create_analytics_dto_1 = require("./create-analytics.dto");
class UpdateAnalyticsDto extends (0, swagger_1.PartialType)(create_analytics_dto_1.CreateAnalyticsDto) {
}
exports.UpdateAnalyticsDto = UpdateAnalyticsDto;
//# sourceMappingURL=update-analytics.dto.js.map