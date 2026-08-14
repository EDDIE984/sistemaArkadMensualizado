export type ChannelActionState={status:"idle"|"success"|"error";message?:string;clientId?:string;fields?:Record<string,string[]>};
export const initialChannelState:ChannelActionState={status:"idle"};
