import { USER, WEBHOOK, IGNORE_CATEGORIES, IGNORE_WORDS, IGNORE_GUILDS } from "./config.json";
import Eris, { GuildTextableChannel, Message } from "eris";
import { inspect } from "util";

const client = Eris(USER.token);

client
    .on('ready', () => {
        console.log(`Sessão iniciada com ${client?.user?.username}#${client?.user?.discriminator}`);
        console.log(`${client.guilds.reduce((acc: number, crt) => acc += crt.channels.filter(c => c.nsfw).length)} canais nsfw encontrados`);
    })
    .on('messageCreate', async (message: Message<any>) => {
        if (message.author.id != USER.id) return;

        let args: string[] = message.content.trim().split(' '),
            channels: GuildTextableChannel[] = [],
            msgs: Message<any>[] = [],
            infoInterval: NodeJS.Timeout,
            infoMsg: Message<GuildTextableChannel>;

        switch (args.shift()) {
            case USER.prefix + 'eval':
                let evaled: unknown = await eval(args.join(' '));
                reply(inspect(evaled));

                return;
            case USER.prefix + 'start':
                infoMsg = await reply(`Coletando mensagens... Isso pode demorar um pouco`)
                infoInterval = setInterval(() =>
                    infoMsg.edit(`Coletando mensagens... Isso pode demorar um pouco\nTotal de mensagens coletadas: ${msgs.length}`)
                        .catch(() => { })
                    , 5_000);

                client.guilds.forEach((g) => {
                    //@ts-ignore
                    if (IGNORE_GUILDS.includes(g.id)) return;

                    g.channels
                        .filter(c => c.type === 0)
                        .forEach((c) => {
                            c = c as GuildTextableChannel;
                            let category = g.channels.get(c?.parentID || '');

                            if (!c.nsfw
                                || channels.includes(c)
                                //@ts-ignore
                                || IGNORE_CATEGORIES.includes(category?.id)
                                || !c.permissionsOf(client.user.id).has('readMessageHistory')
                                || !filter([c?.name, category?.name])
                            ) return;
                            return channels.push(c);
                        })
                });

                for (let i in channels) {
                    await sleep(1_500);
                    let messages = await channels[i].getMessages({ limit: 25 });
                    messages
                        .filter((msg) =>
                            (msg.content.startsWith('https://') || msg.attachments[0]) && !msgs.includes(msg)
                        )
                        .forEach((msg) => msgs.push(msg));
                }
                msgs = msgs.filter(m => m && (m.content || m.attachments[0]));

                for (let i in msgs) {
                    await sleep(3_000);
                    let m = msgs[i],
                        msgObj = {
                            username: 'Sussy Pussy Collector',
                            avatarURL: 'https://api.mcpedl.com/storage/submissions/109757/images/amogus-the-sus-lord_2.png',
                            content: `Número ${i + 1}:\n`,
                            files: []
                        }

                    if (m.content)
                        msgObj.content += m.content.trim().split(' ')[0];
                    if (m.attachments[0])
                        for (let att in m.attachments)
                            msgObj.content += `\n${m.attachments[att].url}`;

                    await client.executeWebhook(WEBHOOK.id, WEBHOOK.token, msgObj);
                }
                clearInterval(infoInterval);
        }

        function filter(content: (string | undefined)[]): Boolean {
            for (let a in content) {
                let str = String(content[a])
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, "")
                    .toLowerCase()

                for (let b in IGNORE_WORDS)
                    if (str.includes(IGNORE_WORDS[b])) return false;
            }

            return true;
        }

        async function reply(content: string) {
            content = content
                .replace(new RegExp(`(${USER.token}|${WEBHOOK.token})`, 'gi'), '')
                .slice(0, 1800);

            return await message.channel.createMessage(content)
                .catch(() => { });
        }

        return;
    })

client.connect();

async function sleep(duration: number) {
    return await new Promise((res) => res(setTimeout(() => { }, duration)));
}