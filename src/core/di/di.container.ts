import 'reflect-metadata';
import { Container } from 'inversify';
import { TYPES } from './types';
import { AuthMySQLDataSource } from '../../data/data_source/mysql/auth.mysql.data-source';
import { AuthRepositoryImpl } from '../../data/repository/auth.repository.impl';
import { AuthRepository } from '../../domain/repository/auth.repository';
import { UserCRUD } from '../../domain/usecases/user.crud';
import { TokenUseCase } from '../../domain/usecases/token.usecase';
import { AuthController } from '../../interface/controller/user.controller';
import { PhoneNumberCRUD } from '../../domain/usecases/phone.number.crud';
import { WhatsAppController } from '../../interface/controller/whatsapp.controller';

import { WebSocketService } from '../../whatsapp_api/websocket.service';
import { BaileysService } from '../../whatsapp_api/baileys.service';
import { MessageService } from '../../whatsapp_api/message.service';

import { HistoryMysqlDataSource } from '../../data/data_source/mysql/history.mysql.data-source';
import { HistoryRepositoryImpl } from '../../data/repository/history.repository.impl';
import { HistoryRepository } from '../../domain/repository/history.repository';
import { HistoryCrud } from '../../domain/usecases/history.cruds';

const container = new Container();

//Auth
container.bind<AuthRepository>(TYPES.AuthRepository).to(AuthRepositoryImpl);
container.bind<AuthMySQLDataSource>(TYPES.AuthMySQLDataSource).to(AuthMySQLDataSource);
container.bind(UserCRUD).toSelf();
container.bind(TokenUseCase).toSelf();
container.bind(AuthController).toSelf();
container.bind(PhoneNumberCRUD).toSelf();

container.bind<HistoryMysqlDataSource>(TYPES.HistoryMysqlDataSource).to(HistoryMysqlDataSource)
container.bind<HistoryRepository>(TYPES.HistoryRepository).to(HistoryRepositoryImpl);
container.bind(HistoryCrud).toSelf();

container.bind(WebSocketService).toSelf().inSingletonScope();
container.bind(BaileysService).toSelf().inSingletonScope();
container.bind(WhatsAppController).toSelf();
container.bind(MessageService).toSelf().inSingletonScope();

export { container };