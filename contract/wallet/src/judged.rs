//! What a signed verdict must show before `execute` acts on it.
//!
//! The signature only proves NEAR AI produced `resp` for `req`. These checks
//! prove `req` asked the right question (the owner's mandate, our prompt, this
//! exact action and args, no steering fields) and `resp` answered `ALLOW` for
//! this action. Decision: docs/decisions/2026-11-01-execute-checks-the-signed-request.md.

use near_sdk::serde::Deserialize;
use near_sdk::serde_json::{self, json, Value};
use near_sdk::{env, require};

/// What the request must match, from the contract's state and the proposal.
pub struct Expected<'a> {
    pub model_id: &'a str,
    pub prompt_hash: &'a str,
    pub mandate_hash: &'a str,
    pub canonical_action: &'a str,
    pub args_json: &'a str,
}

/// Exactly the fields the firewall core sends; any other field, or a
/// duplicate, fails to parse.
#[derive(Deserialize)]
#[serde(crate = "near_sdk::serde", deny_unknown_fields)]
struct Request {
    model: String,
    stream: bool,
    temperature: Value,
    chat_template_kwargs: TemplateKwargs,
    messages: Vec<Message>,
    response_format: Value,
}

#[derive(Deserialize)]
#[serde(crate = "near_sdk::serde", deny_unknown_fields)]
struct TemplateKwargs {
    enable_thinking: bool,
}

#[derive(Deserialize)]
#[serde(crate = "near_sdk::serde", deny_unknown_fields)]
struct Message {
    role: String,
    content: String,
}

#[derive(Deserialize)]
#[serde(crate = "near_sdk::serde", deny_unknown_fields)]
struct UserData {
    mandate: String,
    action: String,
    args: String,
    /// Untrusted by design; not checked.
    #[allow(dead_code)]
    context: String,
}

#[derive(Deserialize)]
#[serde(crate = "near_sdk::serde")]
struct Response {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
#[serde(crate = "near_sdk::serde")]
struct Choice {
    message: ResponseMessage,
}

#[derive(Deserialize)]
#[serde(crate = "near_sdk::serde")]
struct ResponseMessage {
    content: String,
}

#[derive(Deserialize)]
#[serde(crate = "near_sdk::serde", deny_unknown_fields)]
struct Verdict {
    reason: String,
    verdict: String,
    action: String,
}

fn sha256_hex(s: &str) -> String {
    hex::encode(env::sha256(s.as_bytes()))
}

/// The verdict schema the firewall core asks for, with `action` pinned.
fn verdict_schema(canonical_action: &str) -> Value {
    json!({
        "type": "json_schema",
        "json_schema": {
            "name": "verdict",
            "strict": true,
            "schema": {
                "type": "object",
                "properties": {
                    "reason": { "type": "string", "maxLength": 280 },
                    "verdict": { "type": "string", "enum": ["ALLOW", "DENY"] },
                    "action": { "type": "string", "enum": [canonical_action] },
                },
                "required": ["reason", "verdict", "action"],
                "additionalProperties": false,
            },
        },
    })
}

/// Panics unless `req` is the firewall core's request for this proposal,
/// under the owner's mandate and the registered prompt.
pub fn check_request(req: &[u8], e: &Expected) {
    let r: Request = serde_json::from_slice(req)
        .unwrap_or_else(|err| env::panic_str(&format!("request is not the firewall core's shape: {err}")));
    require!(r.model == e.model_id, "request model is not the wallet's model");
    require!(!r.stream, "request must not stream");
    require!(r.temperature == json!(0), "request temperature must be 0");
    require!(!r.chat_template_kwargs.enable_thinking, "request must turn thinking off");
    require!(r.response_format == verdict_schema(e.canonical_action), "request response_format is not the verdict schema for this action");

    require!(r.messages.len() == 2, "request must have exactly two messages");
    let (system, user) = (&r.messages[0], &r.messages[1]);
    require!(system.role == "system" && user.role == "user", "request must have exactly two messages: system, then user");
    require!(sha256_hex(&system.content) == e.prompt_hash, "request system prompt is not the registered prompt");

    let u: UserData = serde_json::from_str(&user.content)
        .unwrap_or_else(|err| env::panic_str(&format!("request user message is not {{mandate, action, args, context}}: {err}")));
    require!(sha256_hex(&u.mandate) == e.mandate_hash, "request mandate is not the registered mandate");
    require!(u.action == e.canonical_action, "request action is not the proposal's action");
    require!(u.args == e.args_json, "request args are not the proposal's args");
}

/// Panics unless `resp` holds exactly one `ALLOW` verdict for this action.
pub fn check_verdict(resp: &[u8], canonical_action: &str) {
    let r: Response = serde_json::from_slice(resp)
        .unwrap_or_else(|err| env::panic_str(&format!("response is not a chat completion: {err}")));
    require!(r.choices.len() == 1, "response must have exactly one choice");
    let v: Verdict = serde_json::from_str(&r.choices[0].message.content)
        .unwrap_or_else(|err| env::panic_str(&format!("verdict is not valid JSON {{reason, verdict, action}}: {err}")));
    require!(v.reason.chars().count() <= 280, "verdict reason is over 280 characters");
    require!(v.action == canonical_action, "verdict is for a different action");
    require!(v.verdict == "ALLOW", "verdict is not ALLOW");
}
