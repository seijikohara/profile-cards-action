import * as exec from '@actions/exec';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { changedPaths, commitAndPush } from '../src/git.js';

vi.mock('@actions/exec');

const execMock = vi.mocked(exec.exec);
const getExecOutputMock = vi.mocked(exec.getExecOutput);

function output(overrides: Partial<exec.ExecOutput> = {}): exec.ExecOutput {
  return { exitCode: 0, stdout: '', stderr: '', ...overrides };
}

describe('changedPaths', () => {
  beforeEach(() => {
    execMock.mockResolvedValue(0);
  });

  it('should return an empty list when git reports no changes', async () => {
    getExecOutputMock.mockResolvedValue(output());
    const paths = await changedPaths('assets');
    expect(paths).toEqual([]);
    // Intent-to-add makes brand-new files visible to `git status`.
    expect(execMock).toHaveBeenCalledWith('git', ['add', '--intent-to-add', 'assets']);
  });

  it('should parse porcelain output into destination paths', async () => {
    getExecOutputMock.mockResolvedValue(
      output({
        stdout: ' M assets/overview.svg\n?? assets/languages.svg\nR  assets/old.svg -> assets/new.svg\n',
      })
    );
    expect(await changedPaths('assets')).toEqual(['assets/overview.svg', 'assets/languages.svg', 'assets/new.svg']);
  });
});

describe('commitAndPush', () => {
  const original = {
    repo: process.env['GITHUB_REPOSITORY'],
    ref: process.env['GITHUB_REF_NAME'],
  };

  beforeEach(() => {
    execMock.mockResolvedValue(0);
    process.env['GITHUB_REPOSITORY'] = 'octocat/hello';
    process.env['GITHUB_REF_NAME'] = 'main';
  });

  afterEach(() => {
    for (const [key, value] of [
      ['GITHUB_REPOSITORY', original.repo],
      ['GITHUB_REF_NAME', original.ref],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('should report no change and skip committing when nothing is staged', async () => {
    getExecOutputMock.mockImplementation(async (_cmd, args) => {
      if (args?.includes('status')) return output({ stdout: '' });
      if (args?.includes('diff')) return output({ exitCode: 0 }); // no staged diff
      return output();
    });

    const result = await commitAndPush({ dir: 'assets', message: 'refresh', token: 'secret' });

    expect(result).toEqual({ changed: false, files: [] });
    const committed = execMock.mock.calls.some(([, args]) => args?.[0] === 'commit');
    expect(committed).toBe(false);
  });

  it('should commit and push the changed files when the tree differs', async () => {
    getExecOutputMock.mockImplementation(async (_cmd, args) => {
      if (args?.includes('status')) return output({ stdout: ' M assets/overview.svg\n' });
      if (args?.includes('diff')) return output({ exitCode: 1 }); // staged changes exist
      if (args?.includes('push')) return output({ exitCode: 0 });
      return output();
    });

    const result = await commitAndPush({ dir: 'assets', message: 'refresh', token: 'secret' });

    expect(result).toEqual({ changed: true, files: ['assets/overview.svg'] });
    expect(execMock).toHaveBeenCalledWith('git', ['config', 'user.name', 'github-actions[bot]']);
    expect(execMock).toHaveBeenCalledWith('git', ['commit', '-m', 'refresh']);
    expect(getExecOutputMock).toHaveBeenCalledWith('git', ['push', 'origin', 'HEAD:main'], expect.anything());
    // The token is embedded in the push URL and set silently (never echoed).
    expect(execMock).toHaveBeenCalledWith(
      'git',
      ['remote', 'set-url', '--push', 'origin', 'https://x-access-token:secret@github.com/octocat/hello.git'],
      { silent: true }
    );
  });

  it('should reset onto the tip and re-commit, then succeed, when the first push is rejected', async () => {
    let pushes = 0;
    getExecOutputMock.mockImplementation(async (_cmd, args) => {
      if (args?.includes('status')) return output({ stdout: ' M assets/overview.svg\n' });
      if (args?.includes('diff')) return output({ exitCode: 1 });
      if (args?.includes('push')) {
        pushes += 1;
        return output({ exitCode: pushes === 1 ? 1 : 0 });
      }
      return output();
    });

    const result = await commitAndPush({ dir: 'assets', message: 'refresh', token: 'secret' });

    expect(result.changed).toBe(true);
    expect(pushes).toBe(2);
    expect(execMock).toHaveBeenCalledWith('git', ['fetch', 'origin', 'main']);
    expect(execMock).toHaveBeenCalledWith('git', ['reset', '--mixed', 'FETCH_HEAD']);
    // Never rebase: the competing commit rewrote the same generated files, so a
    // rebase conflicts on every race and strands the tree mid-rebase.
    const rebased = execMock.mock.calls.some(([, args]) => args?.[0] === 'rebase');
    expect(rebased).toBe(false);
    // The same rendered output is committed again on top of the new tip.
    const commits = execMock.mock.calls.filter(([, args]) => args?.[0] === 'commit');
    expect(commits).toHaveLength(2);
  });

  it('should report no change when the new tip already carries identical output', async () => {
    let diffs = 0;
    getExecOutputMock.mockImplementation(async (_cmd, args) => {
      if (args?.includes('status')) return output({ stdout: ' M assets/overview.svg\n' });
      if (args?.includes('diff')) {
        diffs += 1;
        // Staged changes before the first push; identical to the tip after the reset.
        return output({ exitCode: diffs === 1 ? 1 : 0 });
      }
      if (args?.includes('push')) return output({ exitCode: 1 });
      return output();
    });

    const result = await commitAndPush({ dir: 'assets', message: 'refresh', token: 'secret' });

    expect(result).toEqual({ changed: false, files: [] });
    expect(execMock).toHaveBeenCalledWith('git', ['reset', '--mixed', 'FETCH_HEAD']);
    // Only the pre-push commit ran; the reset left nothing worth re-committing.
    const commits = execMock.mock.calls.filter(([, args]) => args?.[0] === 'commit');
    expect(commits).toHaveLength(1);
  });

  it('should throw after exhausting the push attempts', async () => {
    let pushes = 0;
    getExecOutputMock.mockImplementation(async (_cmd, args) => {
      if (args?.includes('status')) return output({ stdout: ' M assets/overview.svg\n' });
      if (args?.includes('diff')) return output({ exitCode: 1 });
      if (args?.includes('push')) {
        pushes += 1;
        return output({ exitCode: 1 });
      }
      return output();
    });

    await expect(commitAndPush({ dir: 'assets', message: 'refresh', token: 'secret' })).rejects.toThrow(
      'Failed to push to origin/main after 3 attempts.'
    );
    expect(pushes).toBe(3);
  });
});
