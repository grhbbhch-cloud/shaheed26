import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

const rulesConfig = firebaseRulesPlugin.configs['flat/recommended'];

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'uploads/**/*', 'data/**/*'],
  },
  ...(Array.isArray(rulesConfig) ? rulesConfig : [rulesConfig]),
];
