import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ChatService } from './chat.service';
import {
  BuyerChatMessageDto,
  SellerChatMessageDto,
  SellerConversationQueryDto,
  StartConversationDto,
} from './dto/chat.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('start')
  startConversation(@Body() dto: StartConversationDto) {
    return this.chatService.startConversation(dto);
  }

  @Get('track/:orderNumber')
  getConversationByOrder(
    @Param('orderNumber') orderNumber: string,
    @Query('phone') phone: string,
  ) {
    return this.chatService.getConversationByOrder(orderNumber, phone);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('mine/unread-count')
  getUnreadCount(@Request() req: any) {
    return this.chatService.getUnreadCount(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('mine')
  getMyConversations(@Request() req: any, @Query() query: SellerConversationQueryDto) {
    return this.chatService.getMyConversations(req.user.id, query);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('mine/:conversationId')
  getMyConversation(@Request() req: any, @Param('conversationId') conversationId: string) {
    return this.chatService.getMyConversation(req.user.id, conversationId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('mine/:conversationId/messages')
  sendSellerMessage(
    @Request() req: any,
    @Param('conversationId') conversationId: string,
    @Body() dto: SellerChatMessageDto,
  ) {
    return this.chatService.sendSellerMessage(req.user.id, conversationId, dto);
  }

  @Get(':conversationId')
  getBuyerConversation(
    @Param('conversationId') conversationId: string,
    @Query('guestToken') guestToken?: string,
    @Query('orderNumber') orderNumber?: string,
    @Query('phone') phone?: string,
  ) {
    return this.chatService.getConversationForBuyer(conversationId, guestToken, orderNumber, phone);
  }

  @Post(':conversationId/messages')
  sendBuyerMessage(
    @Param('conversationId') conversationId: string,
    @Body() dto: BuyerChatMessageDto,
  ) {
    return this.chatService.sendBuyerMessage(conversationId, dto);
  }
}
