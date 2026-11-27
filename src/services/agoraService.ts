import AgoraRTC, {
  type IAgoraRTCClient,
  type IAgoraRTCRemoteUser,
  type IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";

let client: IAgoraRTCClient | null = null;
let localAudioTrack: IMicrophoneAudioTrack | null = null;

export async function joinVoiceChannel(
  channelName: string,
  role: "caller" | "callee",
  onRemoteUserChange?: (hasRemoteAudio: boolean) => void
): Promise<void> {
  const appId = import.meta.env.VITE_AGORA_APP_ID?.trim();
  const callerToken = import.meta.env.VITE_AGORA_TEMP_TOKEN_1?.trim();
  const calleeToken = import.meta.env.VITE_AGORA_TEMP_TOKEN_2?.trim();
  const fallbackToken = import.meta.env.VITE_AGORA_TEMP_TOKEN?.trim() || null;

  const token =
    role === "caller"
      ? callerToken || fallbackToken
      : calleeToken || fallbackToken;
  const uid = role === "caller" && callerToken ? 1001 : role === "callee" && calleeToken ? 1002 : null;

  if (!appId) {
    throw new Error(
      "Agora App ID is missing. Add VITE_AGORA_APP_ID to your .env file."
    );
  }

  await leaveVoiceChannel();

  const rtcClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
  client = rtcClient;

  rtcClient.on(
    "user-published",
    async (user: IAgoraRTCRemoteUser, mediaType: "audio" | "video") => {
      await rtcClient.subscribe(user, mediaType);
      if (mediaType === "audio") {
        user.audioTrack?.play();
        onRemoteUserChange?.(true);
      }
    }
  );

  rtcClient.on("user-unpublished", (_user, mediaType) => {
    if (mediaType === "audio") {
      onRemoteUserChange?.(false);
    }
  });

  rtcClient.on("user-left", () => {
    onRemoteUserChange?.(false);
  });

  await rtcClient.join(appId, channelName, token, uid);

  try {
    const micTrack = await AgoraRTC.createMicrophoneAudioTrack();
    localAudioTrack = micTrack;
    await rtcClient.publish([micTrack]);
  } catch (micErr) {
    console.warn("Microphone unavailable (listen-only mode):", micErr);
  }
}

export async function setVoiceMicMuted(muted: boolean): Promise<void> {
  if (localAudioTrack) {
    await localAudioTrack.setMuted(muted);
  }
}

export async function leaveVoiceChannel(): Promise<void> {
  if (localAudioTrack) {
    try {
      localAudioTrack.stop();
      localAudioTrack.close();
    } catch {
      // Ignore cleanup errors
    }
    localAudioTrack = null;
  }

  if (client) {
    try {
      client.removeAllListeners();
      await client.leave();
    } catch {
      // Ignore leave errors
    }
    client = null;
  }
}
