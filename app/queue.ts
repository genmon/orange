import type { AppLoadContext } from 'partymix'
import type { ChatCard } from './types/GoogleChatApi'

export const queue = async (
	batch: MessageBatch<ChatCard>,
	context: AppLoadContext
) => {
	for (const message of batch.messages) {
		if (context.FEEDBACK_URL) {
			try {
				await fetch(context.FEEDBACK_URL, {
					method: 'post',
					body: JSON.stringify(message.body),
				})
			} catch (error) {
				message.retry()
			}
		} else {
			console.log('would have posted to feedback URL', message)
		}
	}
}
