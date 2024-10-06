#!/usr/bin/env node
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const figlet_1 = __importDefault(require("figlet"));
const commander_1 = require("commander");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const readDependencies_1 = require("./readDependencies");
const program = new commander_1.Command();
console.log(figlet_1.default.textSync("shalo"));
program
    .command('clone <source>')
    .description('Clone a repository')
    .action(cloneRepo);
program
    .command('checkout')
    .description('Checkout a specific app or folder')
    .option('-a, --apps <app-name>', 'App Name for checkout')
    .option('-e, --exclude <app-name>', 'App Name to exclude from checkout')
    .option('-f, --folder-only <folder-name>', 'Folder Name for checkout')
    .action(checkout);
program
    .command('add <name>')
    .description('Add a folder or NX project to the monorepo')
    .option('-f, --folder-only', 'Add only the folder without computing dependencies')
    .action(addApp);
program
    .command('clean')
    .description('Clean the repository')
    .action(disableSparseCheckout);
program.parse(process.argv);
function disableSparseCheckout() {
    return __awaiter(this, void 0, void 0, function* () {
        executeCommand('git sparse-checkout disable');
        const dirPath = path_1.default.join(__dirname, '/.git/index/sparse-checkout');
        try {
            fs_1.default.rmSync(dirPath, { recursive: true, force: true });
            console.log('Directory deleted successfully');
        }
        catch (err) {
            console.error('Error deleting directory:', err);
        }
        console.log('Removed NXGIT controlled checkout. Now you can use git!!');
    });
}
function addApp(name, options) {
    return __awaiter(this, void 0, void 0, function* () {
        if (options.folderOnly) {
            executeCommand(`git sparse-checkout add ${name}`);
            console.log(`Added folder: ${name}`);
        }
        else {
            const dependencies = (0, readDependencies_1.getAppDependencies)(name);
            dependencies.unshift({ dependency: name, path: name }); // Add the app itself to the list of dependencies
            dependencies.forEach(dep => executeCommand(`git sparse-checkout add ${dep.path}`));
            console.log(`Added NX project: ${name} with dependencies: ${dependencies.map(dep => dep.path).join(', ')}`);
        }
    });
}
function cloneRepo(source) {
    return __awaiter(this, void 0, void 0, function* () {
        executeCommand(`git clone --filter=blob:none ${source}`);
        console.log(`Cloned repository: ${source}`);
    });
}
function findAppDependencies(options) {
    var _a, _b, _c;
    const appNames = options.apps !== '.' ? `${options.apps}` : '';
    const appNameArray = options.apps !== '' && ((_a = options.apps) === null || _a === void 0 ? void 0 : _a.includes(',')) ? appNames.split(',') : [options.apps];
    const dependentAppNames = [];
    const excludedAppNames = options.exclude !== '' ? `${options.exclude}` : '';
    const excludedApps = options.exclude !== '' && ((_b = options.exclude) === null || _b === void 0 ? void 0 : _b.includes(',')) ? excludedAppNames.split(',') : [options.exclude];
    if (((_c = options === null || options === void 0 ? void 0 : options.apps) === null || _c === void 0 ? void 0 : _c.length) > 0) {
        for (let i = 0; i < (appNameArray === null || appNameArray === void 0 ? void 0 : appNameArray.length); i++) {
            const sharedComponentsArray = (0, readDependencies_1.getAppDependencies)(appNameArray[i]);
            const filteredAppsArray = sharedComponentsArray === null || sharedComponentsArray === void 0 ? void 0 : sharedComponentsArray.filter(obj => !excludedApps.some(substring => obj.path.includes(substring)));
            if (filteredAppsArray) {
                for (let j = 0; j < (filteredAppsArray === null || filteredAppsArray === void 0 ? void 0 : filteredAppsArray.length); j++) {
                    dependentAppNames.push(filteredAppsArray[j].path);
                }
                console.log(`Dependencies for ${appNameArray[i]}:`, filteredAppsArray);
            }
        }
    }
    else {
        console.error("No apps specified, are you passing the app name with -a or --apps?");
    }
    return dependentAppNames;
}
function initAndSetSparseCheckoutForApp(options) {
    const command = 'nx';
    const args = ['graph', '--file=output.json'];
    const nxProcess = (0, child_process_1.spawn)(command, args);
    nxProcess.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
    });
    nxProcess.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });
    nxProcess.on('error', (error) => {
        console.error(`Error spawning process: ${error.message}`);
    });
    nxProcess.on('close', (code) => {
        console.log(`Child process exited with code ${code}`);
        if (code !== 0) {
            console.log(`Command Failed nx with code ${code}`);
            return;
        }
        const appFolderNames = findAppDependencies(options);
        console.log('appFolderNames', appFolderNames);
        const gitSparseCheckoutInitSuccess = executeCommand('git sparse-checkout init --cone');
        if (gitSparseCheckoutInitSuccess) {
            executeCommand(`git sparse-checkout set ${appFolderNames.join(" ")}`);
        }
    });
    console.log('Done');
}
function checkout(options) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Called with options %o', options);
        if (options.folderOnly) {
            executeCommand(`git sparse-checkout set ${options.folderOnly}`);
            console.log(`Checked out folder: ${options.folderOnly}`);
        }
        else {
            const isCommandAvailable = checkCommandAvailability('nx');
            if (isCommandAvailable) {
                initAndSetSparseCheckoutForApp(options);
            }
            else {
                console.error("nx command unavailable. Please install nx");
            }
        }
    });
}
function checkCommandAvailability(command) {
    try {
        const stdout = (0, child_process_1.execSync)(`which ${command}`, { encoding: 'utf8' });
        console.log(`Command found: ${stdout.trim()}`);
        return true;
    }
    catch (error) {
        console.error(`Command not found: ${command}`);
        return false;
    }
}
function executeCommand(command) {
    try {
        const stdout = (0, child_process_1.execSync)(command, { encoding: 'utf8' });
        console.log(`Command execution details: ${stdout.trim()}`);
        return true;
    }
    catch (error) {
        console.error(`Command execution failed: ${error.message}`);
        return false;
    }
}
//# sourceMappingURL=index.js.map