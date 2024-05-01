import Toast from '~/components/Toast'
import { useRoomContext } from '~/hooks/useRoomContext'
import { XLobby } from '../_room.$roomName._index'
import { JoinedRoom } from '../_room.$roomName.room'

export default function VideoCall({ roomName }: { roomName: string }) {
	const { joined } = useRoomContext()

	return (
		<div className="w-1/2 h-1/2">
			{!joined && <XLobby roomName={roomName} />}
			{joined && (
				<Toast.Provider>
					<JoinedRoom bugReportsEnabled={false} />
				</Toast.Provider>
			)}
		</div>
	)
}
