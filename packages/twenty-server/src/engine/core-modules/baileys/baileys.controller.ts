import { Controller, Get, Post, Body } from '@nestjs/common';
import { BaileysService } from './baileys.service';
import { SocketGateway } from './socket-gateway/socket.gateway';
// import { SendMessageDto, initApp } from './baileys';
import { BaileysBot , SendMessageDto} from './baileys';
import { MessageDto } from './types/baileys-types';

console.log("BaileysController being called!!!")

@Controller('baileys')
export class BaileysController {
  constructor(
    private readonly BaileysService: BaileysService,
    private readonly socket: SocketGateway,
    ) {
        (async () => {
            let b = await new BaileysBot("baileysController").initApp(socket, "because baileyscontroller wants it")
            this.socket.setBaileys(b)
        })()
    }

  @Get()
  getHello(@Body() ad:SendMessageDto): string {
    console.log(ad);

    return this.BaileysService.getHello();
  }

  @Post('/send-wa-message')
  sendWAMessage(@Body() data:MessageDto): any {
    console.log(data);
    this.socket.sendMessageToBaileys(data)
  }

  @Post('/send-wa-message-file')
  sendWAMessageFile(@Body() data:MessageDto): any {
    console.log(data);
    this.socket.sendMessageFileToBaileys(data)
  }
}