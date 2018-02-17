const config = require('../config.json')
const dbCmds = require('../rss/db/commands.js')
const fileOps = require('../util/fileOps.js')
const channelTracker = require('../util/channelTracker.js')
const currentGuilds = require('../util/storage.js').currentGuilds

module.exports = function (bot, guild) {
  console.log(`Guild "${guild.name}" (ID: ${guild.id}, Users: ${guild.members.size}) has been removed.`)

  guild.channels.forEach(function (channel, channelId) {
    if (channelTracker.hasActiveMenus(channel.id)) channelTracker.remove(channel.id)
  })

  const guildRss = currentGuilds.get(guild.id)
  if (!guildRss) return
  const rssList = guildRss.sources

  for (var rssName in rssList) {
    dbCmds.dropCollection(rssName, err => {
      if (err) console.log(`Guild Warning: Unable to drop ${rssName} for guildDelete`, err.message || err)
    })
  }

  fileOps.deleteGuild(guild.id, null, function (err) {
    if (err) console.log(`Guild Warning: Unable to delete guild ${guild.id} (${guild.name}) after guildDelete:`, err.message)
  })

  if (!config.logging.discordChannelLog) return

  const logChannelId = config.logging.discordChannelLog
  const logChannel = bot.channels.get(config.logging.discordChannelLog)
  if (typeof logChannelId !== 'string' || !logChannel) {
    if (bot.shard) {
      bot.shard.broadcastEval(`
        const channel = this.channels.get('${logChannelId}');
        if (channel) {
          channel.send('Guild Info: "${guild.name}" has been removed.\\nUsers: ${guild.members.size}').catch(err => console.log('Could not log guild removal to Discord, ', err.message || err));
          true;
        }
      `).then(results => {
        for (var x in results) if (results[x]) return
        console.log(`Error: Could not log guild addition to Discord, invalid channel ID.`)
      }).catch(err => console.log(`Guild Info: Error: Could not broadcast eval log channel send for guildDelete. `, err.message || err))
    } else console.log(`Error: Could not log guild removal to Discord, invalid channel ID.`)
  } else logChannel.send(`Guild Info: "${guild.name}" has been removed.\nUsers: ${guild.members.size}`).catch(err => console.log(`Could not log guild removal to Discord. (${err}) `))
}
