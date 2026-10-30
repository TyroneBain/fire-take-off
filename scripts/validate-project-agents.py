"""Validate checked-in role/skill files; this does not claim runtime execution."""
import json
import pathlib
import tomllib

root = pathlib.Path(__file__).resolve().parents[1]
config = tomllib.loads((root / '.codex/config.toml').read_text())
roles = []
for name, entry in config['agents'].items():
    if not isinstance(entry, dict):
        continue
    path = root / '.codex' / entry['config_file']
    role = tomllib.loads(path.read_text())
    assert role['name'] == name
    assert all(isinstance(role.get(k), str) and role[k].strip()
               for k in ('name', 'description', 'developer_instructions'))
    roles.append(name)
assert len(roles) == 8
skills = []
for path in sorted((root / '.agents/skills').glob('*/SKILL.md')):
    content = path.read_text()
    assert content.startswith('---\n')
    front = content.split('---', 2)[1]
    assert f'\nname: {path.parent.name}\n' in front
    assert '\ndescription: ' in front
    skills.append(path.parent.name)
assert len(skills) == 5
print(json.dumps({'roles': roles, 'skills': skills, 'configuration_valid': True,
                  'runtime_execution': 'Must be verified separately in active Codex session'}))
