import Cursors from '~/presence/Cursors'
import PresenceProvider from '~/presence/presence-context'

const PARTYKIT_HOST = '127.0.0.1:1999'
const pageId = 'waterhole'

export default function Waterhole() {
	return (
		<PresenceProvider
			host={PARTYKIT_HOST}
			room={pageId}
			presence={{
				name: 'Anonymous User',
				color: '#0000f0',
			}}
		>
			<div
				style={{ minHeight: '100dvh' }}
				className="w-full absolute top-0 left-0"
			>
				<Cursors />
				<div className="grid h-full gap-4 place-content-center">
					<h1 className="text-3xl font-bold">Hello, Waterhole!</h1>
				</div>
			</div>
		</PresenceProvider>
	)
}
