import { GoogleAuthService, MailerService } from "./gmail-sender.service";
import * as gmailSenderTypes from "./services/gmail-sender-objects-types";
import { Controller, Get, Query,Post, Body, Res, Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import * as fs from 'fs/promises';
import { Response } from 'express';

@Controller("gmail-sender")
export class MailerController {
  constructor(private readonly mailerService: MailerService) {}

  @Post("sendMail")
  async sendEmailOfController( @Body() gmailMessageObject: gmailSenderTypes.GmailMessageData ): Promise<object> {
    try {
      const auth = await this.mailerService.authorize();
      await this.mailerService.sendMails(auth, gmailMessageObject);
      return { status: "Event created successfully" };
    } catch (error) {
      console.error("Error creating event: ", error);
      return { status: "Error creating event", error: error.message };
    }
  }


  @Post("sendMailWithAttachments")
  async sendEmailWithAttachmentsController(
    @Body() gmailMessageObject: gmailSenderTypes.GmailMessageData
  ): Promise<object> {
    try {
      const auth = await this.mailerService.authorize();
      await this.mailerService.sendMailsWithAttachments(auth, gmailMessageObject);
      return { status: "Email sent successfully" };
    } catch (error) {
      console.error("Error sending email with attachments: ", error);
      return { status: "Error sending email", error: error.message };
    }
  }

}



@Controller('auth/google')
export class GoogleAuthController {
  constructor(private readonly googleAuthService: GoogleAuthService) {}

  @Get('start-auth')
  async startAuth(@Res() res: Response) {
    try {
      const authUrl = await this.googleAuthService.getAuthUrl();
      console.log('Redirecting to auth URL:', authUrl);
      res.redirect(authUrl);
    } catch (error) {
      console.error('Error starting auth:', error);
      res.status(500).send(`Error: ${error.message}`);
    }
  }

  @Get('redirect')
  async handleRedirect(@Query('code') code: string, @Res() res: Response) {
    try {
      if (!code) {
        throw new Error('No authorization code received');
      }

      await this.googleAuthService.handleAuthCallback(code);
      
      res.send(`
        <html>
          <body>
            <h1>Authentication Successful!</h1>
            <p>token.json has been created. You can now close this window.</p>
            <p>If you're still seeing auth errors, please:</p>
            <ol>
              <li>Go to your project directory and verify token.json was created</li>
              <li>Restart your NestJS server</li>
              <li>Try your email operation again</li>
            </ol>
          </body>
        </html>
      `);
    } catch (error) {
      res.status(500).send(`
        <html>
          <body>
            <h1>Authentication Failed</h1>
            <p>Error: ${error.message}</p>
            <p>Please try again after:</p>
            <ol>
              <li>Going to <a href="https://myaccount.google.com/permissions" target="_blank">Google Account Permissions</a></li>
              <li>Removing access for your app</li>
              <li>Closing this window and starting over</li>
            </ol>
          </body>
        </html>
      `);
    }
  }
}