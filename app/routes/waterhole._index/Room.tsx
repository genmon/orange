import { useOutletContext } from '@remix-run/react'
import { useMemo, useState } from 'react'
import invariant from 'tiny-invariant'
import { EnsureOnline } from '~/components/EnsureOnline'
import { EnsurePermissions } from '~/components/EnsurePermissions'
import { Icon } from '~/components/Icon/Icon'

import { usePeerConnection } from '~/hooks/usePeerConnection'
import usePushedTrack from '~/hooks/usePushedTrack'
import useRoom from '~/hooks/useRoom'
import type { RoomContextType } from '~/hooks/useRoomContext'
import { RoomContext } from '~/hooks/useRoomContext'
import useUserMedia from '~/hooks/useUserMedia'

export default function RoomWithPermissions({
	children,
}: {
	children: React.ReactNode
}) {
	return (
		<EnsurePermissions>
			<EnsureOnline
				fallback={
					<div className="grid h-full place-items-center">
						<div>
							<h1 className="flex items-center gap-3 text-3xl font-black">
								<Icon type="SignalSlashIcon" />
								You are offline
							</h1>
						</div>
					</div>
				}
			>
				<Room>{children}</Room>
			</EnsureOnline>
		</EnsurePermissions>
	)
}

function tryToGetDimensions(videoStreamTrack?: MediaStreamTrack) {
	if (
		videoStreamTrack === undefined ||
		// TODO: Determine a better way to get dimensions in Firefox
		// where this isn't API isn't supported. For now, Firefox will
		// just not be constrained and scaled down by dimension scaling
		// but the bandwidth and framerate constraints will still apply
		// https://caniuse.com/?search=getCapabilities
		videoStreamTrack.getCapabilities === undefined
	) {
		return { height: 0, width: 0 }
	}
	const height = videoStreamTrack?.getCapabilities().height?.max ?? 0
	const width = videoStreamTrack?.getCapabilities().width?.max ?? 0

	return { height, width }
}

function Room({ children }: { children: React.ReactNode }) {
	const [joined, setJoined] = useState(false)
	//const { roomName } = useParams()
	const roomName = 'waterhole'
	invariant(roomName)

	const {
		mode,
		userDirectoryUrl,
		traceLink,
		apiExtraParams,
		maxWebcamBitrate = 1_200_000,
		maxWebcamFramerate = 24,
		maxWebcamQualityLevel = 1080,
	} = useOutletContext() as any

	const userMedia = useUserMedia(mode)
	const room = useRoom({ roomName, userMedia })
	const { peer, debugInfo, iceConnectionState } =
		usePeerConnection(apiExtraParams)

	const scaleResolutionDownBy = useMemo(() => {
		const videoStreamTrack = userMedia.videoStreamTrack
		const { height, width } = tryToGetDimensions(videoStreamTrack)
		// we need to do this in case camera is in portrait mode
		const smallestDimension = Math.min(height, width)
		return Math.max(smallestDimension / maxWebcamQualityLevel, 1)
	}, [maxWebcamQualityLevel, userMedia.videoStreamTrack])

	const pushedVideoTrack = usePushedTrack(peer, userMedia.videoStreamTrack, {
		maxFramerate: maxWebcamFramerate,
		maxBitrate: maxWebcamBitrate,
		scaleResolutionDownBy,
	})
	const pushedAudioTrack = usePushedTrack(peer, userMedia.audioStreamTrack, {
		priority: 'high',
	})
	const pushedScreenSharingTrack = usePushedTrack(
		peer,
		userMedia.screenShareVideoTrack
	)

	const context: RoomContextType = {
		joined, // this component's state
		setJoined, // this component's state
		traceLink, // from process.env
		userMedia, // HERE: relies on mode from loader
		userDirectoryUrl, // from process.env
		peer, // HERE: relies on mode from loader and process.env
		peerDebugInfo: debugInfo, // HERE: relies on mode from loader and process.env
		iceConnectionState, // HERE: relies on mode from loader and process.env
		room, // HERE: relies on roomName (props) and mode from loader
		pushedTracks: {
			// HERE: relies on mode from loader and process.env
			video: pushedVideoTrack,
			audio: pushedAudioTrack,
			screenshare: pushedScreenSharingTrack,
		},
	}

	// @TODO - Split into a component VideoCall that guarantees permissions, the lot
	// Approach:
	// - Move process.env properties and loader mode into Outlet context
	// - Allow VideoCall to set up RoomContext.Provider using useOutletContext
	// - VideoCall can also managed 'joined' state
	// - Finally move RoomWithPermissions to VideoCallWithPermissions

	return <RoomContext.Provider value={context}>{children}</RoomContext.Provider>
}
