export const help = `

  **Tasks, boards & notes for the command-line habitat.**

  Usage
    $ tb <command> [<args> ...]

  Examples
    $ \`tb\`
    $ \`tb list\`
    $ \`tb list pending coding\`
    $ \`tb archive\`
    $ \`tb timeline\`
    $ \`tb note +coding @interview Mergesort worse-case O(nlogn)\`
    $ \`tb clear\`
    $ \`tb begin 2\`
    $ \`tb check 1 2\`
    $ \`tb check 1 --duration 30\`
    $ \`tb copy 1\`
    $ \`tb delete 4 6\`
    $ \`tb edit 3 Merge PR #42\`
    $ \`tb find documentation\`
    $ \`tb move 1 2 @cooking @tomorrow\`
    $ \`tb priority 3 22 34\`
    $ \`tb restore 4\`
    $ \`tb star 1 2\`
    $ \`tb task +coding @reviews Review PR #42\`
    $ \`tb task +coding Improve documentation\`
    $ \`tb task Make some buttercream\`
    $ \`tb goal Read more\`
    $ \`tb toward 1 34 89\`
    $ \`tb list goals\`
    $ \`tb event 02:30pm 1h Meet at the coffee\`
    $ \`tb list calendar\`
    $ \`tb tag 2 +demo +help\`
    $ \`tb print 1\`
`

export function goodDay() {
  const quote = 'Make that day Phenomenal.'
  console.log(`





                                    ██   ██    ██
                                   ██    ██   ██
                                   ██   ██    ██
                                    ██  ██     ██
                                    ██    ██   ██

                                  █████████████████
                                  ██              ██████
                                  ██              ██  ██
                                  ██              ██  ██
                                  ██              ██████
                                   ██            ██
                                ██████████████████████
                                 ██                ██
                                  ██████████████████


                               ${quote}





`)
}
