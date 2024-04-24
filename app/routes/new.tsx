import { redirect } from 'partymix'

export const loader = async () => {
	const roomName = crypto.randomUUID().split('-')[0]
	return redirect('/' + roomName.toString().replace(/ /g, '-'))
}
