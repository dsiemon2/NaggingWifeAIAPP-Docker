"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var bcrypt_1 = __importDefault(require("bcrypt"));
var prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var superAdminPassword, superAdmin, company, adminPassword, admin, managerPassword, manager, softwareEngineer, technicalCategory, behavioralCategory, cultureFitCategory, technicalQuestions, i, q, behavioralQuestions, i, q, cultureFitQuestions, i, q, aiAgents, _i, aiAgents_1, agent, aiTools, _a, aiTools_1, tool, languages, _b, languages_1, lang, webhooks, _c, webhooks_1, webhook, callTransfers, _d, callTransfers_1, transfer, dtmfMenus, _e, dtmfMenus_1, menu, logicRules, _f, logicRules_1, rule, functions, _g, functions_1, fn, payments, _h, payments_1, payment, tomorrow, nextWeek, interviews, _j, interviews_1, interview;
        return __generator(this, function (_k) {
            switch (_k.label) {
                case 0:
                    console.log('Seeding database...');
                    return [4 /*yield*/, bcrypt_1.default.hash('superadmin123', 12)];
                case 1:
                    superAdminPassword = _k.sent();
                    return [4 /*yield*/, prisma.superAdmin.upsert({
                            where: { email: 'superadmin@system.local' },
                            update: {},
                            create: {
                                email: 'superadmin@system.local',
                                password: superAdminPassword,
                                name: 'System Administrator',
                            },
                        })];
                case 2:
                    superAdmin = _k.sent();
                    console.log('Created super admin:', superAdmin.email);
                    return [4 /*yield*/, prisma.company.upsert({
                            where: { domain: 'demo.local' },
                            update: {},
                            create: {
                                name: 'Demo Company',
                                domain: 'demo.local',
                            },
                        })];
                case 3:
                    company = _k.sent();
                    console.log('Created company:', company.name);
                    return [4 /*yield*/, bcrypt_1.default.hash('admin123', 12)];
                case 4:
                    adminPassword = _k.sent();
                    return [4 /*yield*/, prisma.user.upsert({
                            where: { email_companyId: { email: 'admin@demo.local', companyId: company.id } },
                            update: {},
                            create: {
                                email: 'admin@demo.local',
                                password: adminPassword,
                                name: 'Demo Admin',
                                role: 'COMPANY_ADMIN',
                                companyId: company.id,
                            },
                        })];
                case 5:
                    admin = _k.sent();
                    console.log('Created admin user:', admin.email);
                    return [4 /*yield*/, bcrypt_1.default.hash('manager123', 12)];
                case 6:
                    managerPassword = _k.sent();
                    return [4 /*yield*/, prisma.user.upsert({
                            where: { email_companyId: { email: 'manager@demo.local', companyId: company.id } },
                            update: {},
                            create: {
                                email: 'manager@demo.local',
                                password: managerPassword,
                                name: 'Demo Manager',
                                role: 'MANAGER',
                                companyId: company.id,
                            },
                        })];
                case 7:
                    manager = _k.sent();
                    console.log('Created manager user:', manager.email);
                    return [4 /*yield*/, prisma.jobRole.upsert({
                            where: { id: 'software-engineer-demo' },
                            update: {},
                            create: {
                                id: 'software-engineer-demo',
                                title: 'Software Engineer',
                                description: 'Full-stack software engineer position',
                                companyId: company.id,
                            },
                        })];
                case 8:
                    softwareEngineer = _k.sent();
                    console.log('Created job role:', softwareEngineer.title);
                    return [4 /*yield*/, prisma.questionCategory.upsert({
                            where: { name_jobRoleId: { name: 'Technical', jobRoleId: softwareEngineer.id } },
                            update: {},
                            create: {
                                name: 'Technical',
                                order: 0,
                                jobRoleId: softwareEngineer.id,
                                companyId: company.id,
                            },
                        })];
                case 9:
                    technicalCategory = _k.sent();
                    return [4 /*yield*/, prisma.questionCategory.upsert({
                            where: { name_jobRoleId: { name: 'Behavioral', jobRoleId: softwareEngineer.id } },
                            update: {},
                            create: {
                                name: 'Behavioral',
                                order: 1,
                                jobRoleId: softwareEngineer.id,
                                companyId: company.id,
                            },
                        })];
                case 10:
                    behavioralCategory = _k.sent();
                    return [4 /*yield*/, prisma.questionCategory.upsert({
                            where: { name_jobRoleId: { name: 'Culture Fit', jobRoleId: softwareEngineer.id } },
                            update: {},
                            create: {
                                name: 'Culture Fit',
                                order: 2,
                                jobRoleId: softwareEngineer.id,
                                companyId: company.id,
                            },
                        })];
                case 11:
                    cultureFitCategory = _k.sent();
                    console.log('Created question categories');
                    technicalQuestions = [
                        {
                            text: 'Explain the difference between REST and GraphQL APIs. When would you choose one over the other?',
                            followUps: ['Can you give an example from your experience?', 'How would you handle versioning in each approach?'],
                            evaluationCriteria: 'Understands architectural trade-offs, can articulate pros/cons clearly',
                            timeAllocation: 5,
                            isRequired: true,
                        },
                        {
                            text: 'Describe how you would design a scalable notification system that handles millions of users.',
                            followUps: ['How would you handle message queuing?', 'What about real-time vs batch delivery?'],
                            evaluationCriteria: 'System design thinking, knowledge of distributed systems, practical considerations',
                            timeAllocation: 8,
                            isRequired: true,
                        },
                        {
                            text: 'What is your debugging process when you encounter a production issue?',
                            followUps: ['Can you walk me through a recent example?', 'How do you prioritize when multiple issues arise?'],
                            evaluationCriteria: 'Systematic approach, use of tools, communication during incidents',
                            timeAllocation: 5,
                            isRequired: false,
                        },
                    ];
                    i = 0;
                    _k.label = 12;
                case 12:
                    if (!(i < technicalQuestions.length)) return [3 /*break*/, 15];
                    q = technicalQuestions[i];
                    return [4 /*yield*/, prisma.question.upsert({
                            where: { id: "tech-q-".concat(i + 1) },
                            update: {},
                            create: {
                                id: "tech-q-".concat(i + 1),
                                text: q.text,
                                followUps: JSON.stringify(q.followUps),
                                evaluationCriteria: q.evaluationCriteria,
                                timeAllocation: q.timeAllocation,
                                isRequired: q.isRequired,
                                order: i,
                                categoryId: technicalCategory.id,
                            },
                        })];
                case 13:
                    _k.sent();
                    _k.label = 14;
                case 14:
                    i++;
                    return [3 /*break*/, 12];
                case 15:
                    console.log('Created technical questions');
                    behavioralQuestions = [
                        {
                            text: 'Tell me about a time when you had a disagreement with a team member. How did you resolve it?',
                            followUps: ['What would you do differently?', 'How did this affect your working relationship afterwards?'],
                            evaluationCriteria: 'Conflict resolution, communication skills, self-awareness',
                            timeAllocation: 5,
                            isRequired: true,
                        },
                        {
                            text: 'Describe a project you\'re most proud of. What was your specific contribution?',
                            followUps: ['What challenges did you overcome?', 'What did you learn from this experience?'],
                            evaluationCriteria: 'Technical depth, ownership, ability to articulate impact',
                            timeAllocation: 6,
                            isRequired: true,
                        },
                    ];
                    i = 0;
                    _k.label = 16;
                case 16:
                    if (!(i < behavioralQuestions.length)) return [3 /*break*/, 19];
                    q = behavioralQuestions[i];
                    return [4 /*yield*/, prisma.question.upsert({
                            where: { id: "behav-q-".concat(i + 1) },
                            update: {},
                            create: {
                                id: "behav-q-".concat(i + 1),
                                text: q.text,
                                followUps: JSON.stringify(q.followUps),
                                evaluationCriteria: q.evaluationCriteria,
                                timeAllocation: q.timeAllocation,
                                isRequired: q.isRequired,
                                order: i,
                                categoryId: behavioralCategory.id,
                            },
                        })];
                case 17:
                    _k.sent();
                    _k.label = 18;
                case 18:
                    i++;
                    return [3 /*break*/, 16];
                case 19:
                    console.log('Created behavioral questions');
                    cultureFitQuestions = [
                        {
                            text: 'Why are you interested in this company and role?',
                            followUps: ['What research have you done about our company?', 'How does this align with your career goals?'],
                            evaluationCriteria: 'Genuine interest, research effort, alignment with company values',
                            timeAllocation: 4,
                            isRequired: true,
                        },
                        {
                            text: 'What type of work environment helps you do your best work?',
                            followUps: ['How do you handle remote vs in-office work?', 'What about collaboration vs independent work?'],
                            evaluationCriteria: 'Self-awareness, fit with team culture, adaptability',
                            timeAllocation: 4,
                            isRequired: false,
                        },
                    ];
                    i = 0;
                    _k.label = 20;
                case 20:
                    if (!(i < cultureFitQuestions.length)) return [3 /*break*/, 23];
                    q = cultureFitQuestions[i];
                    return [4 /*yield*/, prisma.question.upsert({
                            where: { id: "culture-q-".concat(i + 1) },
                            update: {},
                            create: {
                                id: "culture-q-".concat(i + 1),
                                text: q.text,
                                followUps: JSON.stringify(q.followUps),
                                evaluationCriteria: q.evaluationCriteria,
                                timeAllocation: q.timeAllocation,
                                isRequired: q.isRequired,
                                order: i,
                                categoryId: cultureFitCategory.id,
                            },
                        })];
                case 21:
                    _k.sent();
                    _k.label = 22;
                case 22:
                    i++;
                    return [3 /*break*/, 20];
                case 23:
                    console.log('Created culture fit questions');
                    // Create app config
                    return [4 /*yield*/, prisma.appConfig.upsert({
                            where: { id: 'default' },
                            update: {},
                            create: {
                                id: 'default',
                                appName: 'AI Recruiting Assistant',
                                selectedVoice: 'alloy',
                                maxInterviewMins: 60,
                                transcriptionEnabled: true,
                                autoSummaryEnabled: true,
                            },
                        })];
                case 24:
                    // Create app config
                    _k.sent();
                    console.log('Created app config');
                    aiAgents = [
                        {
                            id: 'agent-interviewer',
                            name: 'Interview Screener',
                            description: 'Conducts initial candidate screening interviews',
                            systemPrompt: 'You are a professional HR interviewer conducting an initial screening call. Be friendly but professional. Ask questions clearly and listen actively. Provide appropriate follow-up questions based on responses.',
                            model: 'gpt-4o-realtime',
                            voice: 'alloy',
                            temperature: 0.7,
                            isActive: true,
                        },
                        {
                            id: 'agent-technical',
                            name: 'Technical Assessor',
                            description: 'Conducts technical interviews and coding assessments',
                            systemPrompt: 'You are a senior technical interviewer. Assess candidates on their technical knowledge, problem-solving ability, and coding skills. Ask clarifying questions and provide hints when appropriate.',
                            model: 'gpt-4o-realtime',
                            voice: 'echo',
                            temperature: 0.5,
                            isActive: true,
                        },
                        {
                            id: 'agent-scheduler',
                            name: 'Interview Scheduler',
                            description: 'Helps candidates schedule and reschedule interviews',
                            systemPrompt: 'You are a helpful scheduling assistant. Help candidates find suitable interview times, handle rescheduling requests, and answer questions about the interview process.',
                            model: 'gpt-4o',
                            voice: 'nova',
                            temperature: 0.7,
                            isActive: true,
                        },
                    ];
                    _i = 0, aiAgents_1 = aiAgents;
                    _k.label = 25;
                case 25:
                    if (!(_i < aiAgents_1.length)) return [3 /*break*/, 28];
                    agent = aiAgents_1[_i];
                    return [4 /*yield*/, prisma.aIAgent.upsert({
                            where: { id: agent.id },
                            update: {},
                            create: agent,
                        })];
                case 26:
                    _k.sent();
                    _k.label = 27;
                case 27:
                    _i++;
                    return [3 /*break*/, 25];
                case 28:
                    console.log('Created AI agents');
                    aiTools = [
                        {
                            id: 'tool-schedule',
                            name: 'schedule_followup',
                            description: 'Schedule a follow-up interview with the candidate',
                            type: 'function',
                            schema: JSON.stringify({
                                type: 'object',
                                properties: {
                                    candidateEmail: { type: 'string', description: 'Candidate email address' },
                                    dateTime: { type: 'string', description: 'Proposed date and time' },
                                    interviewType: { type: 'string', enum: ['technical', 'behavioral', 'final'] },
                                },
                                required: ['candidateEmail', 'dateTime', 'interviewType'],
                            }),
                            isActive: true,
                        },
                        {
                            id: 'tool-lookup',
                            name: 'lookup_candidate',
                            description: 'Look up candidate information from the database',
                            type: 'api',
                            schema: JSON.stringify({
                                type: 'object',
                                properties: {
                                    email: { type: 'string', description: 'Candidate email to look up' },
                                },
                                required: ['email'],
                            }),
                            endpoint: '/api/candidates/lookup',
                            isActive: true,
                        },
                        {
                            id: 'tool-notify',
                            name: 'send_notification',
                            description: 'Send email or SMS notification to candidate or recruiter',
                            type: 'webhook',
                            schema: JSON.stringify({
                                type: 'object',
                                properties: {
                                    recipient: { type: 'string' },
                                    channel: { type: 'string', enum: ['email', 'sms'] },
                                    message: { type: 'string' },
                                },
                                required: ['recipient', 'channel', 'message'],
                            }),
                            endpoint: 'https://hooks.example.com/notify',
                            isActive: true,
                        },
                    ];
                    _a = 0, aiTools_1 = aiTools;
                    _k.label = 29;
                case 29:
                    if (!(_a < aiTools_1.length)) return [3 /*break*/, 32];
                    tool = aiTools_1[_a];
                    return [4 /*yield*/, prisma.aITool.upsert({
                            where: { id: tool.id },
                            update: {},
                            create: tool,
                        })];
                case 30:
                    _k.sent();
                    _k.label = 31;
                case 31:
                    _a++;
                    return [3 /*break*/, 29];
                case 32:
                    console.log('Created AI tools');
                    languages = [
                        { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', enabled: true },
                        { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', enabled: true },
                        { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', enabled: false },
                        { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', enabled: false },
                    ];
                    _b = 0, languages_1 = languages;
                    _k.label = 33;
                case 33:
                    if (!(_b < languages_1.length)) return [3 /*break*/, 36];
                    lang = languages_1[_b];
                    return [4 /*yield*/, prisma.language.upsert({
                            where: { code: lang.code },
                            update: {},
                            create: lang,
                        })];
                case 34:
                    _k.sent();
                    _k.label = 35;
                case 35:
                    _b++;
                    return [3 /*break*/, 33];
                case 36:
                    console.log('Created languages');
                    webhooks = [
                        {
                            id: 'webhook-slack',
                            name: 'Slack Notifications',
                            url: 'https://hooks.slack.com/services/EXAMPLE/WEBHOOK',
                            events: JSON.stringify(['interview.completed', 'score.generated']),
                            secret: 'whsec_example123',
                            isActive: true,
                        },
                        {
                            id: 'webhook-ats',
                            name: 'ATS Integration',
                            url: 'https://ats.example.com/webhooks/recruiting',
                            events: JSON.stringify(['interview.created', 'interview.completed', 'candidate.no_show']),
                            secret: 'ats_secret_key',
                            isActive: true,
                        },
                    ];
                    _c = 0, webhooks_1 = webhooks;
                    _k.label = 37;
                case 37:
                    if (!(_c < webhooks_1.length)) return [3 /*break*/, 40];
                    webhook = webhooks_1[_c];
                    return [4 /*yield*/, prisma.webhook.upsert({
                            where: { id: webhook.id },
                            update: {},
                            create: webhook,
                        })];
                case 38:
                    _k.sent();
                    _k.label = 39;
                case 39:
                    _c++;
                    return [3 /*break*/, 37];
                case 40:
                    console.log('Created webhooks');
                    // ==============================
                    // SMS SETTINGS
                    // ==============================
                    return [4 /*yield*/, prisma.sMSSettings.upsert({
                            where: { id: 'sms-default' },
                            update: {},
                            create: {
                                id: 'sms-default',
                                provider: 'twilio',
                                accountSid: 'AC_EXAMPLE_SID',
                                authToken: 'AUTH_TOKEN_EXAMPLE',
                                fromNumber: '+15551234567',
                                enableReminders: true,
                                reminderHours: 24,
                                isActive: true,
                            },
                        })];
                case 41:
                    // ==============================
                    // SMS SETTINGS
                    // ==============================
                    _k.sent();
                    console.log('Created SMS settings');
                    callTransfers = [
                        {
                            id: 'transfer-hr',
                            name: 'HR Department',
                            description: 'Transfer to HR for general inquiries',
                            phoneNumber: '+15559876543',
                            sipUri: 'sip:hr@company.com',
                            priority: 10,
                            isActive: true,
                        },
                        {
                            id: 'transfer-recruiter',
                            name: 'Lead Recruiter',
                            description: 'Transfer to lead recruiter for urgent matters',
                            phoneNumber: '+15551112222',
                            priority: 20,
                            isActive: true,
                        },
                        {
                            id: 'transfer-emergency',
                            name: 'Emergency Support',
                            description: 'After-hours emergency support line',
                            phoneNumber: '+15553334444',
                            priority: 5,
                            isActive: false,
                        },
                    ];
                    _d = 0, callTransfers_1 = callTransfers;
                    _k.label = 42;
                case 42:
                    if (!(_d < callTransfers_1.length)) return [3 /*break*/, 45];
                    transfer = callTransfers_1[_d];
                    return [4 /*yield*/, prisma.callTransfer.upsert({
                            where: { id: transfer.id },
                            update: {},
                            create: transfer,
                        })];
                case 43:
                    _k.sent();
                    _k.label = 44;
                case 44:
                    _d++;
                    return [3 /*break*/, 42];
                case 45:
                    console.log('Created call transfer targets');
                    dtmfMenus = [
                        { id: 'dtmf-1', name: 'Repeat Question', digit: '1', action: 'repeat', prompt: 'Press 1 to hear the question again', isActive: true },
                        { id: 'dtmf-2', name: 'Skip Question', digit: '2', action: 'skip', prompt: 'Press 2 to skip to the next question', isActive: true },
                        { id: 'dtmf-0', name: 'Transfer to Human', digit: '0', action: 'transfer', targetId: 'transfer-hr', prompt: 'Press 0 to speak with a human representative', isActive: true },
                        { id: 'dtmf-star', name: 'Pause Interview', digit: '*', action: 'pause', prompt: 'Press star to pause the interview', isActive: true },
                        { id: 'dtmf-hash', name: 'End Interview', digit: '#', action: 'end', prompt: 'Press pound to end the interview', isActive: true },
                    ];
                    _e = 0, dtmfMenus_1 = dtmfMenus;
                    _k.label = 46;
                case 46:
                    if (!(_e < dtmfMenus_1.length)) return [3 /*break*/, 49];
                    menu = dtmfMenus_1[_e];
                    return [4 /*yield*/, prisma.dTMFMenu.upsert({
                            where: { id: menu.id },
                            update: {},
                            create: menu,
                        })];
                case 47:
                    _k.sent();
                    _k.label = 48;
                case 48:
                    _e++;
                    return [3 /*break*/, 46];
                case 49:
                    console.log('Created DTMF menu options');
                    logicRules = [
                        {
                            id: 'rule-low-score',
                            name: 'Low Score Alert',
                            description: 'Notify HR when interview score is below threshold',
                            trigger: 'score.generated',
                            conditions: JSON.stringify([{ field: 'overallScore', operator: '<', value: 3 }]),
                            actions: JSON.stringify([{ type: 'email', to: 'hr@company.com', template: 'low_score_alert' }]),
                            priority: 10,
                            isActive: true,
                        },
                        {
                            id: 'rule-no-show',
                            name: 'No Show Follow-up',
                            description: 'Automatically reschedule when candidate is a no-show',
                            trigger: 'candidate.no_show',
                            conditions: JSON.stringify([]),
                            actions: JSON.stringify([
                                { type: 'email', to: 'candidate', template: 'reschedule_invite' },
                                { type: 'sms', to: 'candidate', template: 'no_show_followup' },
                            ]),
                            priority: 5,
                            isActive: true,
                        },
                        {
                            id: 'rule-high-score',
                            name: 'Fast Track High Performers',
                            description: 'Automatically advance candidates with high scores',
                            trigger: 'interview.completed',
                            conditions: JSON.stringify([{ field: 'overallScore', operator: '>=', value: 4 }]),
                            actions: JSON.stringify([{ type: 'webhook', url: '/api/fast-track', data: { stage: 'final_interview' } }]),
                            priority: 15,
                            isActive: true,
                        },
                    ];
                    _f = 0, logicRules_1 = logicRules;
                    _k.label = 50;
                case 50:
                    if (!(_f < logicRules_1.length)) return [3 /*break*/, 53];
                    rule = logicRules_1[_f];
                    return [4 /*yield*/, prisma.logicRule.upsert({
                            where: { id: rule.id },
                            update: {},
                            create: rule,
                        })];
                case 51:
                    _k.sent();
                    _k.label = 52;
                case 52:
                    _f++;
                    return [3 /*break*/, 50];
                case 53:
                    console.log('Created logic rules');
                    functions = [
                        {
                            id: 'fn-score-calc',
                            name: 'calculateWeightedScore',
                            description: 'Calculate weighted interview score based on category weights',
                            code: "function calculateWeightedScore(scores, weights) {\n  let total = 0;\n  let weightSum = 0;\n  for (const category in scores) {\n    if (weights[category]) {\n      total += scores[category] * weights[category];\n      weightSum += weights[category];\n    }\n  }\n  return weightSum > 0 ? total / weightSum : 0;\n}",
                            parameters: JSON.stringify([
                                { name: 'scores', type: 'object', description: 'Category scores object' },
                                { name: 'weights', type: 'object', description: 'Category weights object' },
                            ]),
                            returnType: 'number',
                            isActive: true,
                        },
                        {
                            id: 'fn-format-time',
                            name: 'formatInterviewDuration',
                            description: 'Format interview duration in human-readable format',
                            code: "function formatInterviewDuration(minutes) {\n  if (minutes < 60) return minutes + ' minutes';\n  const hours = Math.floor(minutes / 60);\n  const mins = minutes % 60;\n  return hours + ' hour' + (hours > 1 ? 's' : '') + (mins > 0 ? ' ' + mins + ' min' : '');\n}",
                            parameters: JSON.stringify([{ name: 'minutes', type: 'number', description: 'Duration in minutes' }]),
                            returnType: 'string',
                            isActive: true,
                        },
                    ];
                    _g = 0, functions_1 = functions;
                    _k.label = 54;
                case 54:
                    if (!(_g < functions_1.length)) return [3 /*break*/, 57];
                    fn = functions_1[_g];
                    return [4 /*yield*/, prisma.function.upsert({
                            where: { id: fn.id },
                            update: {},
                            create: fn,
                        })];
                case 55:
                    _k.sent();
                    _k.label = 56;
                case 56:
                    _g++;
                    return [3 /*break*/, 54];
                case 57:
                    console.log('Created functions');
                    payments = [
                        {
                            id: 'pay-001',
                            amount: 299.00,
                            currency: 'USD',
                            status: 'completed',
                            method: 'card',
                            transactionId: 'txn_1234567890',
                            description: 'Pro Plan - Monthly',
                            companyId: company.id,
                        },
                        {
                            id: 'pay-002',
                            amount: 299.00,
                            currency: 'USD',
                            status: 'completed',
                            method: 'card',
                            transactionId: 'txn_1234567891',
                            description: 'Pro Plan - Monthly',
                            companyId: company.id,
                        },
                        {
                            id: 'pay-003',
                            amount: 49.00,
                            currency: 'USD',
                            status: 'completed',
                            method: 'paypal',
                            transactionId: 'txn_1234567892',
                            description: 'Additional Interview Credits (50)',
                            companyId: company.id,
                        },
                        {
                            id: 'pay-004',
                            amount: 299.00,
                            currency: 'USD',
                            status: 'pending',
                            method: 'bank',
                            description: 'Pro Plan - Monthly',
                            companyId: company.id,
                        },
                    ];
                    _h = 0, payments_1 = payments;
                    _k.label = 58;
                case 58:
                    if (!(_h < payments_1.length)) return [3 /*break*/, 61];
                    payment = payments_1[_h];
                    return [4 /*yield*/, prisma.payment.upsert({
                            where: { id: payment.id },
                            update: {},
                            create: payment,
                        })];
                case 59:
                    _k.sent();
                    _k.label = 60;
                case 60:
                    _h++;
                    return [3 /*break*/, 58];
                case 61:
                    console.log('Created sample payments');
                    tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    tomorrow.setHours(10, 0, 0, 0);
                    nextWeek = new Date();
                    nextWeek.setDate(nextWeek.getDate() + 7);
                    nextWeek.setHours(14, 0, 0, 0);
                    interviews = [
                        {
                            id: 'interview-001',
                            candidateName: 'John Smith',
                            candidateEmail: 'john.smith@example.com',
                            candidatePhone: '+15551234567',
                            mode: 'HYBRID',
                            status: 'SCHEDULED',
                            scheduledAt: tomorrow,
                            duration: 45,
                            notes: 'Strong resume, 5 years experience',
                            jobRoleId: softwareEngineer.id,
                            companyId: company.id,
                        },
                        {
                            id: 'interview-002',
                            candidateName: 'Sarah Johnson',
                            candidateEmail: 'sarah.j@example.com',
                            candidatePhone: '+15559876543',
                            mode: 'AI_ONLY',
                            status: 'SCHEDULED',
                            scheduledAt: nextWeek,
                            duration: 30,
                            notes: 'Referral from current employee',
                            jobRoleId: softwareEngineer.id,
                            companyId: company.id,
                        },
                        {
                            id: 'interview-003',
                            candidateName: 'Michael Chen',
                            candidateEmail: 'mchen@example.com',
                            mode: 'HYBRID',
                            status: 'COMPLETED',
                            scheduledAt: new Date(Date.now() - 86400000 * 3), // 3 days ago
                            duration: 60,
                            jobRoleId: softwareEngineer.id,
                            companyId: company.id,
                        },
                    ];
                    _j = 0, interviews_1 = interviews;
                    _k.label = 62;
                case 62:
                    if (!(_j < interviews_1.length)) return [3 /*break*/, 65];
                    interview = interviews_1[_j];
                    return [4 /*yield*/, prisma.interview.upsert({
                            where: { id: interview.id },
                            update: {},
                            create: interview,
                        })];
                case 63:
                    _k.sent();
                    _k.label = 64;
                case 64:
                    _j++;
                    return [3 /*break*/, 62];
                case 65: 
                // Add result for completed interview
                return [4 /*yield*/, prisma.interviewResult.upsert({
                        where: { interviewId: 'interview-003' },
                        update: {},
                        create: {
                            interviewId: 'interview-003',
                            transcript: 'Full transcript of the interview...',
                            summary: 'Strong technical skills, excellent communication. Demonstrated deep knowledge of system design and practical experience with microservices architecture.',
                            scorecard: JSON.stringify({
                                technical: 4,
                                behavioral: 5,
                                cultureFit: 4,
                            }),
                            managerNotes: 'Recommend moving to final round',
                            overallScore: 4,
                            recommendation: 'YES',
                        },
                    })];
                case 66:
                    // Add result for completed interview
                    _k.sent();
                    console.log('Created sample interviews');
                    console.log('\n✅ Database seeded successfully!');
                    console.log('\n📋 Login credentials:');
                    console.log('---');
                    console.log('Super Admin:');
                    console.log('  Email: superadmin@system.local');
                    console.log('  Password: superadmin123');
                    console.log('---');
                    console.log('Company Admin:');
                    console.log('  Email: admin@demo.local');
                    console.log('  Password: admin123');
                    console.log('---');
                    console.log('Manager:');
                    console.log('  Email: manager@demo.local');
                    console.log('  Password: manager123');
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(function (e) {
    console.error('Seed error:', e);
    process.exit(1);
})
    .finally(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma.$disconnect()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
