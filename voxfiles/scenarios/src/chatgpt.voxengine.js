require(Modules.ASR)

// OpenAI API URL
const openaiURL = 'https://api.openai.com/v1/chat/completions'
// Your OpenAI API KEY
const openaiApiKey = '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'
// Array that will contain all chat messages
var messages = [
    { "role": "system", "content": "Jij bent AssistentGPT, een geduldige, begripvolle assistent dat via de telefoon mensen probeert te woord te staan."}
]


// Send request to the API
async function requestCompletion() {
    return Net.httpRequestAsync(openaiURL, {
        headers: [
            "Content-Type: application/json",
            "Authorization: Bearer " + openaiApiKey
        ],
        method: 'POST',
        postData: JSON.stringify({
            "model": "gpt-3.5-turbo",
            "messages": messages
            // you can configure the length of the answer
            // by sending the max_tokens parameter, e.g.:
            // "max_tokens": 150
        })
    })
}

// some vars to use in the scenario
var call, player, asr;
const defaultVoice = VoiceList.Google.nl_BE_Wavenet_A;

// Process the inbound call
VoxEngine.addEventListener(AppEvents.CallAlerting, (e) => {
    call = e.call
    // Use Google for STT with singleUtterance on
    asr = VoxEngine.createASR({
        profile: ASRProfileList.Google.nl_NL,
        singleUtterance: true
    })
    // Process ASR result
    asr.addEventListener(ASREvents.Result, async (e) => {
        // Messages array is used for the conversation context according to the OpenAI API
        messages.push({ "role": "user", "content": e.text })
        Logger.write("Sending data to the OpenAI endpoint")
        // Add some "telemetry" to understand how long it took OpenAI to process the request
        let ts1 = Date.now();
        var res = await requestCompletion()
        let ts2 = Date.now();
        Logger.write("Request complete in " + (ts2 - ts1) + " ms")

if (res.code == 200) {
            let jsData = JSON.parse(res.text)
            player = VoxEngine.createTTSPlayer(jsData.choices[0].message.content,
                {
                    language: defaultVoice,
                    progressivePlayback: false
                })
            player.sendMediaTo(call)
            player.addMarker(-300)
            // Push the message to the conversation array
            messages.push({ role: "assistant", content: jsData.choices[0].message.content })
        } else {
            Logger.write(res.code + " : " + res.text)
            player = VoxEngine.createTTSPlayer('Sorry, iets ging fout, kan je het opnieuw proberen?',
                {
                    language: defaultVoice,
                    progressivePlayback: false
                })
            player.sendMediaTo(call)
            player.addMarker(-300)
        }
        player.addEventListener(PlayerEvents.PlaybackMarkerReached, (ev) => {
            player.removeEventListener(PlayerEvents.PlaybackMarkerReached)
            call.sendMediaTo(asr)
        })
    })
    // Say some prompt after the call is connected 
    call.addEventListener(CallEvents.Connected, (e) => {
        player = VoxEngine.createTTSPlayer('Haai, de vriendelijke assistent hier, waarmee kan ik u van dienst zijn?',
            {
                language: defaultVoice
            })
        player.sendMediaTo(call)
        player.addMarker(-300)
        player.addEventListener(PlayerEvents.PlaybackMarkerReached, (ev) => {            
            player.removeEventListener(PlayerEvents.PlaybackMarkerReached)
            // Send media to the ASR
            call.sendMediaTo(asr)
        })
    })
    // Terminate the session after hangup
    call.addEventListener(CallEvents.Disconnected, (e) => {
        VoxEngine.terminate()
    })
    // Answer the call
    call.answer()
})