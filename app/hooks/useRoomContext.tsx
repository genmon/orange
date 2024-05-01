//import { useOutletContext } from '@remix-run/react'
import { createContext, useContext } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { UserMedia } from '~/hooks/useUserMedia'
import type Peer from '~/utils/Peer.client'
import type { PeerDebugInfo } from '~/utils/Peer.client'
import type useRoom from './useRoom'

export type RoomContextType = {
	traceLink?: string
	userDirectoryUrl?: string
	joined: boolean
	setJoined: Dispatch<SetStateAction<boolean>>
	userMedia: UserMedia
	peer: Peer | null
	peerDebugInfo?: PeerDebugInfo
	iceConnectionState: RTCIceConnectionState
	room: ReturnType<typeof useRoom>
	pushedTracks: {
		video?: string
		audio?: string
		screenshare?: string
	}
}

export const RoomContext = createContext<RoomContextType | undefined>(undefined)

export default function RoomProvider({
	children,
	value,
}: {
	children: React.ReactNode
	value: RoomContextType
}) {
	return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>
}

export function useRoomContext(): RoomContextType {
	const context = useContext(RoomContext)
	if (!context) {
		throw new Error('useRoomContext must be used within a RoomProvider')
	}
	return context
}
