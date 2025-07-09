import identity from './identity';
import goals from './goals';
import tone from './tone';
import boundaries from './boundaries';
import examples from './examples';

const athenaPrompt = `
${identity}

${goals}

${tone}

${boundaries}

${examples}
`;

export default athenaPrompt;
