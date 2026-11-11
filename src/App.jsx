import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { MAX_FIELD_LENGTH, RECONNECT_GRACE_MS } from './game.js'
import './App.css'

const SESSION_PREFIX = 'what-if-room:'

function App() {
  const [roomId, setRoomId] = useState(getRoomIdFromPath)

  useEffect(() => {
    const handlePopState = () => setRoomId(getRoomIdFromPath())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = useCallback((nextRoomId) => {
    const path = nextRoomId ? `/room/${nextRoomId}` : '/'
    window.history.pushState({}, '', path)
    setRoomId(nextRoomId)
  }, [])

  return roomId
    ? <RoomPage roomId={roomId} onLeave={() => navigate(null)} />
    : <HomePage onRoomCreated={navigate} />
}

function HomePage({ onRoomCreated }) {
  const [roomCode, setRoomCode] = useState('')
  const [rooms, setRooms] = useState([])
  const [isPrivate, setIsPrivate] = useState(false)
  const [accessCode, setAccessCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [roomListError, setRoomListError] = useState('')

  useEffect(() => {
    let active = true
    let requestInProgress = false

    async function refreshRooms() {
      if (requestInProgress) {
        return
      }
      requestInProgress = true
      try {
        const response = await fetch('/api/rooms')
        const payload = await readResponse(response)
        if (active) {
          setRooms(payload.rooms)
          setRoomListError('')
        }
      } catch (requestError) {
        if (active) {
          setRoomListError(requestError.message)
        }
      } finally {
        requestInProgress = false
      }
    }

    refreshRooms()
    const timer = window.setInterval(refreshRooms, 5000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  async function createRoom() {
    const cleanAccessCode = accessCode.trim()
    if (isPrivate && [...cleanAccessCode].length < 5) {
      setError('Private room codes must be at least 5 characters.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isPrivate, accessCode: cleanAccessCode }),
      })
      const payload = await readResponse(response)
      onRoomCreated(payload.roomId)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  function joinRoom(event) {
    event.preventDefault()
    const id = roomCode.trim()
    if (!id) {
      setError('Enter the room code from your host.')
      return
    }
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      setError('That room code does not look valid.')
      return
    }
    setError('')
    onRoomCreated(id)
  }

  return (
    <main className="home-shell">
      <header className="brand-lockup">
        <div className="brand-mark" aria-hidden="true">?</div>
        <span>what if?</span>
      </header>

      <section className="home-hero">
        <p className="eyebrow">A party game for unexpected answers</p>
        <h1>One little question.<br /><span>A room full of possibilities.</span></h1>
        <p className="hero-copy">
          Write a “What if…” and an answer. Shuffle the cards, then see what happens
          when the room reads them out of order.
        </p>
      </section>

      <section className="home-actions" aria-label="Start or join a game">
        <div className="action-card create-card">
          <div className="action-icon" aria-hidden="true">✳</div>
          <h2>Start a new room</h2>
          <p>Make a room and invite everyone with its QR code.</p>
          <label className="private-room-option">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(event) => setIsPrivate(event.target.checked)}
            />
            Make this room private
          </label>
          {isPrivate && (
            <label className="private-code-field">
              Access code (at least 5 characters)
              <input
                type="password"
                autoComplete="new-password"
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value)}
                minLength={5}
                required
              />
            </label>
          )}
          <button className="button button-primary" type="button" onClick={createRoom} disabled={busy}>
            {busy ? 'Creating room…' : 'Create a room'}
          </button>
        </div>

        <div className="action-card join-card">
          <div className="action-icon action-icon-lilac" aria-hidden="true">↗</div>
          <h2>Join a room</h2>
          <p>Already have an invite? Enter the room code.</p>
          <form onSubmit={joinRoom} className="join-form">
            <label className="sr-only" htmlFor="room-code">Room code</label>
            <input
              id="room-code"
              autoComplete="off"
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value)}
              placeholder="Paste room code"
            />
            <button className="button button-dark" type="submit">Join</button>
          </form>
        </div>
      </section>

      <section className="room-directory" aria-labelledby="room-directory-title">
        <div className="room-directory-heading">
          <div>
            <p className="eyebrow">Come play</p>
            <h2 id="room-directory-title">Active rooms</h2>
          </div>
          <span>{rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}</span>
        </div>
        {roomListError && <p className="error-banner" role="alert">{roomListError}</p>}
        {rooms.length === 0 ? (
          <p className="room-directory-empty">No active rooms yet. Start one and invite your friends.</p>
        ) : (
          <div className="room-directory-grid">
            {rooms.map((room) => {
              const canJoin = ['lobby', 'completed'].includes(room.phase)
              return (
                <article className="room-directory-card" key={room.roomId}>
                  <div className="room-directory-info">
                    <h3>
                      Room {shortRoomId(room.roomId)}
                      {room.isPrivate && <span className="room-lock" aria-label="Private room">🔒</span>}
                    </h3>
                    <p>{room.playerCount} {room.playerCount === 1 ? 'player' : 'players'} · {phaseLabel(room.phase)}</p>
                  </div>
                  <button
                    className="button button-outline button-small"
                    type="button"
                    disabled={!canJoin}
                    onClick={() => onRoomCreated(room.roomId)}
                  >
                    {canJoin ? 'Join room' : 'In progress'}
                  </button>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {error && <p className="error-banner" role="alert">{error}</p>}

      <footer className="home-footer">
        <span>Good questions. Unexpected answers.</span>
        <details className="home-help">
          <summary>How to play</summary>
          <p>Everyone writes a “What if…” and an answer on one card. The room shuffles the cards so nobody gets their own, then reads each player’s Question followed by the next player’s Answer.</p>
        </details>
      </footer>
    </main>
  )
}

function RoomPage({ roomId, onLeave }) {
  const [credentials, setCredentials] = useState(() => readCredentials(roomId))
  const [nickname, setNickname] = useState('')
  const [roomAccessCode, setRoomAccessCode] = useState('')
  const [room, setRoom] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [socketStatus, setSocketStatus] = useState('connecting')
  const [now, setNow] = useState(0)
  const socketRef = useRef(null)

  const joinUrl = useMemo(() => `${window.location.origin}/room/${roomId}`, [roomId])
  const myPlayer = room?.players.find((player) => player.id === credentials?.playerId)

  const refreshRoom = useCallback(async () => {
    const params = new URLSearchParams()
    if (credentials) {
      params.set('playerId', credentials.playerId)
      params.set('token', credentials.token)
    }
    const query = params.size ? `?${params}` : ''
    const response = await fetch(`/api/rooms/${roomId}${query}`)
    const payload = await readResponse(response)
    setRoom(payload.state)
    setError('')
  }, [credentials, roomId])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      refreshRoom()
        .catch((requestError) => {
          if (active) {
            setError(requestError.message)
          }
        })
        .finally(() => {
          if (active) {
            setLoading(false)
          }
        })
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [refreshRoom])

  useEffect(() => {
    if (!credentials) {
      return undefined
    }

    let retryTimer
    let retryDelay = 1000
    let stopped = false
    let socket

    function connect() {
      if (stopped) {
        return
      }
      setSocketStatus('connecting')
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const params = new URLSearchParams({
        playerId: credentials.playerId,
        token: credentials.token,
      })
      socket = new WebSocket(`${protocol}//${window.location.host}/api/rooms/${roomId}/connect?${params}`)
      socketRef.current = socket

      socket.onopen = () => {
        retryDelay = 1000
        setSocketStatus('connected')
        refreshRoom().catch((requestError) => setError(requestError.message))
      }
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.type === 'state') {
            setRoom(message.state)
            setError('')
            if (message.state.phase === 'closed') {
              window.localStorage.removeItem(`${SESSION_PREFIX}${roomId}`)
              setCredentials(null)
              setSocketStatus('connected')
            }
          }
        } catch (parseError) {
          setError(`Could not read the room update: ${parseError.message}`)
        }
      }
      socket.onerror = () => setSocketStatus('disconnected')
      socket.onclose = () => {
        setSocketStatus('disconnected')
        if (!stopped) {
          retryTimer = window.setTimeout(connect, retryDelay)
          retryDelay = Math.min(retryDelay * 2, 5000)
        }
      }
    }

    retryTimer = window.setTimeout(connect, 0)
    return () => {
      stopped = true
      window.clearTimeout(retryTimer)
      socket?.close()
      socketRef.current = null
    }
  }, [credentials, refreshRoom, roomId])

  useEffect(() => {
    if (socketStatus === 'connected') {
      return undefined
    }
    const timer = window.setInterval(() => {
      refreshRoom().catch((requestError) => setError(requestError.message))
    }, 3000)
    return () => window.clearInterval(timer)
  }, [refreshRoom, socketStatus])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  async function act(action, details = {}) {
    setError('')
    try {
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action,
          ...details,
          ...(credentials ?? {}),
        }),
      })
      const payload = await readResponse(response)
      if (action === 'join') {
        const nextCredentials = payload.player
        window.localStorage.setItem(
          `${SESSION_PREFIX}${roomId}`,
          JSON.stringify(nextCredentials),
        )
        setCredentials(nextCredentials)
      }
      if (payload.state) {
        setRoom(payload.state)
      }
      if (payload.warning) {
        setError(payload.warning)
      }
      if (action === 'delete-room') {
        window.localStorage.removeItem(`${SESSION_PREFIX}${roomId}`)
        socketRef.current?.close()
        setCredentials(null)
        setSocketStatus('connected')
      }
      if (action === 'leave') {
        window.localStorage.removeItem(`${SESSION_PREFIX}${roomId}`)
        socketRef.current?.close()
        onLeave()
      }
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(joinUrl)
      setError('')
    } catch (copyError) {
      setError(`Could not copy the invite link: ${copyError.message}`)
    }
  }

  if (loading) {
    return <main className="loading-screen">Opening your room…</main>
  }

  if (error && !room) {
    return (
      <main className="error-screen">
        <p className="eyebrow">Room unavailable</p>
        <h1>We can’t open this room.</h1>
        <p>{error}</p>
        <button className="button button-primary" type="button" onClick={onLeave}>Back to home</button>
      </main>
    )
  }

  if (!room) {
    return <main className="loading-screen">Loading room…</main>
  }

  if (room.phase === 'closed') {
    return (
      <main className="error-screen">
        <p className="eyebrow">Room closed</p>
        <h1>This room is no longer available.</h1>
        <p>The room has been closed. Its saved data is retained.</p>
        <button className="button button-primary" type="button" onClick={onLeave}>Back to home</button>
      </main>
    )
  }

  if (!credentials || !myPlayer) {
    return (
      <main className="join-screen">
        <header className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">?</div>
          <span>what if?</span>
        </header>
        <section className="join-panel">
          <p className="eyebrow">You’re invited</p>
          <h1>Join the room</h1>
          <p>Pick a nickname so everyone knows who’s playing.</p>
          <form
            className="nickname-form"
            onSubmit={(event) => {
              event.preventDefault()
              act('join', { nickname, accessCode: roomAccessCode })
            }}
          >
            <label htmlFor="nickname">Your nickname</label>
            <input
              id="nickname"
              autoComplete="nickname"
              maxLength={24}
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="e.g. Captain Maybe"
              required
            />
            {room.isPrivate && (
              <>
                <label htmlFor="private-room-code">Room access code</label>
                <input
                  id="private-room-code"
                  type="password"
                  autoComplete="current-password"
                  value={roomAccessCode}
                  onChange={(event) => setRoomAccessCode(event.target.value)}
                  required
                />
              </>
            )}
            <button className="button button-primary" type="submit">Join room</button>
          </form>
          {error && <p className="error-banner" role="alert">{error}</p>}
        </section>
      </main>
    )
  }

  const allReady = room.allReady
  const pausedReady = room.players.length > 0
    && room.players.every((player) => player.ready && player.connected)
  const myTurn = room.nextReveal?.playerId === myPlayer.id
  const nextIsQuestion = room.phase === 'revealing' && !room.nextReveal
  const canStartRound = room.phase === 'lobby' && allReady
  const canResume = room.phase === 'paused' && pausedReady
  const canDistribute = room.phase === 'submitting'
    && room.allSubmitted

  return (
    <main className="room-shell">
      <header className="room-topbar">
        <button className="brand-lockup brand-button" type="button" onClick={onLeave}>
          <span className="brand-mark" aria-hidden="true">?</span>
          <span>what if?</span>
        </button>
        <div className="room-top-actions">
          <span className={`connection-indicator ${socketStatus}`}>
            <span aria-hidden="true" />
            {socketStatus === 'connected' ? 'Live room' : 'Reconnecting'}
          </span>
          <button className="button button-quiet" type="button" onClick={() => act('leave')}>
            Leave game
          </button>
        </div>
      </header>

      <div className="room-layout">
        <section className="game-column">
          <div className="room-heading">
            <div>
              <p className="eyebrow">Room {shortRoomId(room.id)}</p>
              <h1>{room.phase === 'lobby' ? 'The room is yours.' : `Round ${room.roundNumber}`}</h1>
            </div>
            <div className={`phase-pill phase-${room.phase}`}>
              <span className="phase-dot" />
              {phaseLabel(room.phase)}
            </div>
          </div>

          {error && <p className="error-banner" role="alert">{error}</p>}

          {room.phase === 'lobby' && (
            <LobbyPanel
              room={room}
              me={myPlayer}
              onReady={(ready) => act('ready', { ready })}
              onStart={() => act('start-round')}
              onDelete={() => {
                if (window.confirm('Close this room for everyone? Players will lose access, but saved data will be retained.')) {
                  act('delete-room')
                }
              }}
              canStart={canStartRound}
            />
          )}

          {room.phase === 'submitting' && (
            <SubmissionPanel
              room={room}
              me={myPlayer}
              onSubmit={(question, answer) => act('submit', { question, answer })}
              onDistribute={() => act('distribute')}
              canDistribute={canDistribute}
            />
          )}

          {room.phase === 'revealing' && (
            <RevealPanel
              room={room}
              myTurn={myTurn}
              nextIsQuestion={nextIsQuestion}
              onReveal={(type) => act('reveal', { type })}
            />
          )}

          {room.phase === 'paused' && (
            <PausedPanel
              me={myPlayer}
              canResume={canResume}
              onReady={(ready) => act('ready', { ready })}
              onResume={() => act('resume')}
            />
          )}

          {room.phase === 'completed' && (
            <CompletedPanel
              room={room}
              onNextRound={() => act('begin-next-round')}
              onEndGame={() => {
                if (window.confirm('End the game? Everyone will return to the lobby, where all completed rounds remain available to review.')) {
                  act('end-game')
                }
              }}
            />
          )}
        </section>

        <aside className="room-sidebar">
          <InviteCard joinUrl={joinUrl} onCopy={copyInvite} />
          <PlayersCard
            players={room.players}
            me={myPlayer}
            now={now}
            onRemove={(targetPlayerId) => act('remove-player', { targetPlayerId })}
          />
        </aside>
      </div>
    </main>
  )
}

function LobbyPanel({ room, me, onReady, onStart, onDelete, canStart }) {
  return (
    <section className="stage-card">
      <span className="stage-number">01 / READY UP</span>
      <h2>{room.gameEnded ? 'The game has ended.' : 'Everyone in? Get ready.'}</h2>
      <p className="stage-copy">
        {room.gameEnded
          ? 'The room is still open. Review completed rounds or ready up to play again.'
          : 'A round starts when at least two players are connected and everyone is ready. Any player can kick things off once the room is set.'}
      </p>
      <div className="stage-action-row">
        <button
          className={`button ${me.ready ? 'button-ready' : 'button-primary'}`}
          type="button"
          onClick={() => onReady(!me.ready)}
        >
          {me.ready ? 'You’re ready ✓' : 'I’m ready'}
        </button>
        <button
          className="button button-dark"
          type="button"
          disabled={!canStart}
          onClick={onStart}
        >
          Start round
        </button>
      </div>
      {!canStart && (
        <p className="helper-text">
          {room.players.length < 2
            ? 'Invite at least one more player to begin.'
            : 'Waiting for every connected player to mark Ready.'}
        </p>
      )}
      <RoundHistory history={room.history} />
      {room.gameEnded && (
        <button className="button button-danger" type="button" onClick={onDelete}>
          Delete room
        </button>
      )}
    </section>
  )
}

function SubmissionPanel({ room, me, onSubmit, onDistribute, canDistribute }) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (me.submitted) {
    return (
      <section className="stage-card">
        <span className="stage-number">02 / WRITE A CARD</span>
        <h2>Your card is in the basket.</h2>
        <p className="stage-copy">
          {room.allSubmitted
            ? 'Everyone has submitted. Any player can shuffle and distribute the cards.'
            : 'Your Question and Answer are hidden from the room until they are revealed.'}
        </p>
        <div className="waiting-row">
          <span className="waiting-spinner" aria-hidden="true" />
          <span>{room.players.filter((player) => player.submitted).length} of {room.players.length} cards submitted</span>
        </div>
        {canDistribute && (
          <button className="button button-primary" type="button" onClick={onDistribute}>
            Shuffle and distribute cards
          </button>
        )}
      </section>
    )
  }

  return (
    <section className="stage-card">
      <span className="stage-number">02 / WRITE A CARD</span>
      <h2>What if… you wrote the next surprise?</h2>
      <p className="stage-copy">Write both parts on one card. Keep it short, and keep it kind.</p>
      <form
        className="card-form"
        onSubmit={async (event) => {
          event.preventDefault()
          setSubmitting(true)
          const cleanQuestion = question.trim()
          const fullQuestion = /^what if(?:\s|[.!?…]|$)/i.test(cleanQuestion)
            ? cleanQuestion
            : `What if ${cleanQuestion}`
          await onSubmit(fullQuestion, answer)
          setSubmitting(false)
        }}
      >
        <label htmlFor="question">Question</label>
        <div className="input-prefix">
          <span aria-hidden="true">What if</span>
          <input
            id="question"
            maxLength={MAX_FIELD_LENGTH - 8}
            value={question}
            onChange={(event) => setQuestion(event.target.value.replace(/^what if\s*/i, ''))}
            placeholder="animals could talk?"
            required
          />
        </div>
        <label htmlFor="answer">Answer</label>
        <textarea
          id="answer"
          maxLength={MAX_FIELD_LENGTH}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Then the moon would be made of cheese."
          rows={3}
          required
        />
        <div className="form-footer">
          <span>Answers are best in one short sentence.</span>
          <button className="button button-primary" type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit card'}
          </button>
        </div>
      </form>
      <p className="helper-text">
        {room.players.filter((player) => player.submitted).length} of {room.players.length} players have submitted
      </p>
    </section>
  )
}

function RevealPanel({ room, myTurn, nextIsQuestion, onReveal }) {
  const action = room.nextReveal
  const isStarterChoice = nextIsQuestion && room.reveals.length === 0
  const canReveal = isStarterChoice || (myTurn && Boolean(action))
  const revealType = isStarterChoice ? 'question' : action?.type

  return (
    <section className="stage-card reveal-stage">
      <span className="stage-number">03 / READ THE ROOM</span>
      <h2>{room.reveals.length ? 'Let the cards do the talking.' : 'Who wants to go first?'}</h2>
      <p className="stage-copy">
        {isStarterChoice
          ? 'Choose a starting player. They reveal the Question on their assigned card.'
          : action
            ? action.type === 'answer'
              ? `${nicknameFor(room, action.playerId)} reveals an Answer, then their Question.`
              : `${nicknameFor(room, action.playerId)} reveals their Question.`
            : 'The round is ready to begin.'}
      </p>

      {room.reveals.length > 0 && (
        <ol className="reveal-list" aria-live="polite">
          {room.reveals.map((revealItem, index) => (
            <li className={`reveal-item reveal-${revealItem.type}`} key={`${index}-${revealItem.playerId}`}>
              <span className="reveal-index">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <span className="reveal-label">
                  {revealItem.type === 'question' ? 'QUESTION' : 'ANSWER'}
                  {' · CARD BY '}
                  {revealItem.authorNickname ?? 'AUTHOR UNAVAILABLE'}
                </span>
                <p>{revealItem.text}</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {canReveal && revealType && (
        <button className="button button-primary reveal-button" type="button" onClick={() => onReveal(revealType)}>
          Show {revealType === 'question' ? 'Question' : 'Answer'}
        </button>
      )}
      {!canReveal && action && (
        <div className="waiting-row">
          <span className="waiting-spinner" aria-hidden="true" />
          <span>Waiting for {nicknameFor(room, action.playerId)} to show their {action.type}…</span>
        </div>
      )}
      {room.nextReveal && (
        <p className="turn-hint">
          {myTurn ? `It’s your turn to show the ${action.type}.` : `Your card stays private until its turn.`}
        </p>
      )}
    </section>
  )
}

function PausedPanel({ me, canResume, onReady, onResume }) {
  return (
    <section className="stage-card paused-stage">
      <span className="stage-number">ROUND PAUSED</span>
      <h2>Let’s get everyone back on the same page.</h2>
      <p className="stage-copy">
        A player was disconnected for more than 30 seconds. They can still reconnect until
        an active player removes them. All remaining players must be ready to resume.
      </p>
      <div className="stage-action-row">
        <button
          className={`button ${me.ready ? 'button-ready' : 'button-primary'}`}
          type="button"
          onClick={() => onReady(!me.ready)}
        >
          {me.ready ? 'You’re ready ✓' : 'I’m ready'}
        </button>
        <button className="button button-dark" type="button" disabled={!canResume} onClick={onResume}>
          Resume round
        </button>
      </div>
      {!canResume && <p className="helper-text">Waiting for every remaining connected player to be ready.</p>}
    </section>
  )
}

function CompletedPanel({ room, onNextRound, onEndGame }) {
  return (
    <section className="stage-card completed-stage">
      <span className="stage-number">ROUND COMPLETE</span>
      <h2>That was a good what-if.</h2>
      <p className="stage-copy">
        The final answer will stay here until someone chooses what happens next.
      </p>
      <RevealList reveals={room.reveals} />
      <div className="stage-action-row round-end-actions">
        <button className="button button-primary" type="button" onClick={onNextRound}>
          Start another round
        </button>
        <button className="button button-outline" type="button" onClick={onEndGame}>
          End game
        </button>
      </div>
      <p className="helper-text">
        Starting another round returns to the lobby; everyone must be ready before it begins.
      </p>
    </section>
  )
}

function RoundHistory({ history }) {
  if (!history?.length) {
    return null
  }
  return (
    <details className="round-history">
      <summary>Review completed rounds ({history.length})</summary>
      <div className="round-history-list">
        {[...history].reverse().map((round) => (
          <section className="round-history-item" key={round.roundNumber}>
            <h3>Round {round.roundNumber}</h3>
            <RevealList reveals={round.reveals} />
          </section>
        ))}
      </div>
    </details>
  )
}

function RevealList({ reveals }) {
  return (
    <ol className="reveal-list" aria-live="polite">
      {reveals.map((revealItem, index) => (
        <li className={`reveal-item reveal-${revealItem.type}`} key={`${index}-${revealItem.playerId}`}>
          <span className="reveal-index">{String(index + 1).padStart(2, '0')}</span>
          <div>
            <span className="reveal-label">
              {revealItem.type === 'question' ? 'QUESTION' : 'ANSWER'} · {revealItem.nickname}
            </span>
            <p>{revealItem.text}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

function InviteCard({ joinUrl, onCopy }) {
  return (
    <section className="sidebar-card invite-card">
      <div className="sidebar-card-heading">
        <div>
          <p className="eyebrow">Bring everyone in</p>
          <h2>Share this room</h2>
        </div>
        <span className="sidebar-icon" aria-hidden="true">⌁</span>
      </div>
      <div className="qr-frame">
        <QRCodeSVG value={joinUrl} size={160} bgColor="#ffffff" fgColor="#20201f" level="M" />
      </div>
      <p className="qr-help">Scan the code to join on another device.</p>
      <p className="room-code">{new URL(joinUrl).pathname.split('/').pop()}</p>
      <button className="button button-outline button-full" type="button" onClick={onCopy}>
        Copy invite link
      </button>
    </section>
  )
}

function PlayersCard({ players, me, now, onRemove }) {
  return (
    <section className="sidebar-card players-card">
      <div className="sidebar-card-heading">
        <div>
          <p className="eyebrow">The group</p>
          <h2>Players <span className="player-count">{players.length}</span></h2>
        </div>
        <span className="sidebar-icon" aria-hidden="true">◉</span>
      </div>
      <ul className="player-list">
        {players.map((player, index) => {
          const timedOut = !player.connected
            && player.disconnectedAt
            && now - player.disconnectedAt >= RECONNECT_GRACE_MS
          return (
            <li className="player-row" key={player.id}>
              <span className={`avatar avatar-${index % 5}`}>{player.nickname.charAt(0).toUpperCase()}</span>
              <span className="player-name">
                <span>{player.nickname}{player.id === me.id ? ' (you)' : ''}</span>
                <span className="player-status">
                  {!player.connected ? timedOut ? 'Needs room decision' : 'Reconnecting'
                    : player.submitted ? 'Card submitted'
                      : player.ready ? 'Ready' : 'In the room'}
                </span>
                {timedOut && (
                  <button
                    className="button button-small button-outline remove-player-button"
                    type="button"
                    onClick={() => onRemove(player.id)}
                  >
                    Remove
                  </button>
                )}
              </span>
              {player.ready && <span className="ready-check" aria-label="Ready">✓</span>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function getRoomIdFromPath() {
  const match = window.location.pathname.match(/^\/room\/([0-9a-f-]{36})\/?$/i)
  return match?.[1] ?? null
}

function readCredentials(roomId) {
  try {
    const value = window.localStorage.getItem(`${SESSION_PREFIX}${roomId}`)
    if (!value) {
      return null
    }
    const credentials = JSON.parse(value)
    return credentials.playerId && credentials.token ? credentials : null
  } catch {
    window.localStorage.removeItem(`${SESSION_PREFIX}${roomId}`)
    return null
  }
}

async function readResponse(response) {
  let payload
  try {
    payload = await response.json()
  } catch {
    throw new Error(`The server returned an unreadable response (${response.status}).`)
  }
  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed (${response.status}).`)
  }
  return payload
}

function nicknameFor(room, playerId) {
  return room.players.find((player) => player.id === playerId)?.nickname ?? 'A player'
}

function shortRoomId(id) {
  return id.slice(0, 8).toUpperCase()
}

function phaseLabel(phase) {
  return {
    lobby: 'Lobby',
    submitting: 'Writing cards',
    revealing: 'Reveal round',
    paused: 'Paused',
    completed: 'Between rounds',
  }[phase] ?? phase
}

export default App
