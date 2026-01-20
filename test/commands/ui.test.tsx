import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('ui', () => {
  it('runs ui cmd', async () => {
    const {stdout} = await runCommand('ui')
    expect(stdout).to.contain('hello world')
  })

  it('runs ui --name oclif', async () => {
    const {stdout} = await runCommand('ui --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
