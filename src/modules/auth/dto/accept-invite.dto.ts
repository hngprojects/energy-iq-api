import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class AcceptInviteDto {
    @ApiProperty({ description: 'invite token sent to their email (or in the invite body)' })
    @IsUUID()
    inviteToken: string;
}