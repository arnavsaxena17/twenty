import {  Controller,  Post, Req } from '@nestjs/common';
import { FacebookWhatsappChatApi } from '../services/whatsapp-api/facebook-whatsapp/facebook-whatsapp-api';

import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';



@Controller('whatsapp-controller')
export class WhatsappControllers {

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService
  ) {}
  @Post('uploadFile')
  async uploadFileToFBWAAPI(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    console.log('upload file to whatsapp api');
    const requestBody = request?.body;
    const filePath = requestBody?.filePath;
    const response = await new FacebookWhatsappChatApi(this.workspaceQueryService).uploadFileToWhatsAppUsingControllerApi(filePath, apiToken);
    return response || {}; // Return an empty object if the response is undefined
  }
}
