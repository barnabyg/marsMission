import { describe, expect, it } from "vitest";
import { actionsFor, newLines } from "./browserGame";
import { createOpenAiModel, type StructuredRequest } from "./model";
import { createModelPlayer, viewText } from "./modelPlayer";
import { blindPlayJob, type PlayerView } from "./blindPlay";

const view: PlayerView = {
  job: blindPlayJob,
  notes: "",
  turn: 1,
  recent: [
    { action: 'Tick "Pathfinder Orbiter"', result: "New on screen:\n- a\n- b" },
  ],
  screen: {
    name: "Planning Mode",
    turn: 1,
    text: '- heading "Planning Mode" [level=1]',
    actions: [
      { label: 'Press "Launch Mission"', kind: "click" },
      { label: 'Untick "Pathfinder Orbiter"', kind: "untick" },
    ],
    ended: null,
  },
  warning: null,
};

function answering(body: unknown, status = 200) {
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  const fetch = (url: string, init: RequestInit) => {
    requests.push({
      url,
      body: JSON.parse(init.body as string) as Record<string, unknown>,
    });
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };
  return { fetch, requests };
}

const call = (name: string, args: unknown) => ({
  output: [
    { type: "reasoning" },
    { type: "function_call", name, arguments: JSON.stringify(args) },
  ],
  usage: { input_tokens: 1200, output_tokens: 80 },
});

describe("the blind player", () => {
  it("is shown its notes, its last steps, the screen and numbered actions", () => {
    const text = viewText(view);
    expect(text).toContain("Your notes:\n(none yet)");
    expect(text).toContain(
      '- Tick "Pathfinder Orbiter"\n  New on screen:\n  - a\n  - b',
    );
    expect(text).toContain("The screen: Planning Mode\n- heading");
    expect(text).toContain(
      'Actions:\n1. Press "Launch Mission"\n2. Untick "Pathfinder Orbiter"',
    );
  });

  it("asks OpenAI for one strict function call and reads its answer and usage", async () => {
    const choice = {
      thinks: "t",
      wants: "w",
      puzzled: "",
      learned: true,
      notes: "n",
      choice: 2,
    };
    const { fetch, requests } = answering(call("take_action", choice));
    const player = createModelPlayer(
      createOpenAiModel({ apiKey: "k", model: "gpt-test", fetch }),
    );
    const answer = await player.choose(view);
    expect(answer).toEqual({
      choice,
      usage: { inputTokens: 1200, outputTokens: 80 },
    });
    expect(player.identity).toEqual({ provider: "openai", model: "gpt-test" });
    const body = requests[0]?.body;
    expect(body).toMatchObject({
      model: "gpt-test",
      tool_choice: { type: "function", name: "take_action" },
      store: false,
    });
    expect(body?.reasoning).toBeUndefined();
  });

  it("fails on an answer without the tool call or with the wrong fields", async () => {
    const empty = createOpenAiModel({
      apiKey: "k",
      model: "m",
      fetch: answering({ output: [] }).fetch,
    });
    const request: StructuredRequest = {
      instructions: "",
      input: "",
      name: "take_action",
      description: "",
      schema: {},
    };
    await expect(empty.ask(request)).rejects.toThrow(
      "did not answer with take_action",
    );
    const wrong = createModelPlayer(
      createOpenAiModel({
        apiKey: "k",
        model: "m",
        fetch: answering(call("take_action", { choice: 1 })).fetch,
      }),
    );
    await expect(wrong.choose(view)).rejects.toThrow("expected fields");
  });

  it("tries again after a server error, but not after a bad request", async () => {
    let calls = 0;
    const flaky = (status: number) => () => {
      calls += 1;
      return Promise.resolve(new Response("busy", { status }));
    };
    const request: StructuredRequest = {
      instructions: "",
      input: "",
      name: "x",
      description: "",
      schema: {},
    };
    await expect(
      createOpenAiModel({
        apiKey: "k",
        model: "m",
        retries: 2,
        fetch: flaky(503),
      }).ask(request),
    ).rejects.toThrow("OpenAI answered 503: busy");
    expect(calls).toBe(3);
    calls = 0;
    await expect(
      createOpenAiModel({ apiKey: "k", model: "m", fetch: flaky(400) }).ask(
        request,
      ),
    ).rejects.toThrow("400");
    expect(calls).toBe(1);
  });
});

describe("the browser game's actions", () => {
  it("names each control as an action, every option of a select but the chosen one", () => {
    const control = { checked: false, options: [] };
    const actions = actionsFor(
      [
        { ...control, id: "0", type: "button", label: "Save" },
        { ...control, id: "1", type: "checkbox", label: "Pathfinder Orbiter" },
        {
          ...control,
          id: "2",
          type: "checkbox",
          label: "Kick stage",
          checked: true,
        },
        {
          ...control,
          id: "3",
          type: "select",
          label: "Trajectory",
          options: [{ value: "fast", text: "Fast ($40M)" }],
        },
        { ...control, id: "4", type: "term", label: "Public Support" },
        { ...control, id: "5", type: "button", label: "Save" },
      ],
      true,
    );
    expect(actions.map(({ action }) => action.label)).toEqual([
      'Press "Save"',
      'Tick "Pathfinder Orbiter"',
      'Untick "Kick stage"',
      'Set "Trajectory" to "Fast ($40M)"',
      'Hover over "Public Support" to read its tooltip',
      'Press "Save" (2)',
      "Wait and watch what happens",
    ]);
    expect(actions[3]?.target).toEqual({ id: "3", value: "fast" });
  });

  it("reports only the lines a step added", () => {
    expect(newLines("- a\n- b", "- a\n- c\n  - b")).toEqual(["- c"]);
    expect(newLines("", "1\n2\n3", 2)).toEqual([
      "1",
      "2",
      "… and 1 more lines",
    ]);
  });
});
