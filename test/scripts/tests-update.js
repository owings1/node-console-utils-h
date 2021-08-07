const fs = require('fs')
const path = require('path')
const {resolve, basename} = path
const {strings: {endsWith}, objects: {lset, revalue}, Logger, Is, typeOf} = require('../../index.js')
const BaseDir = resolve(__dirname, '../..')
const abspath = (...args) => path.resolve(BaseDir, ...args)
const relpath = (...args) => path.relative(BaseDir, ...args)
const logger = new Logger

function render(template, vars) {
    Object.entries(vars).forEach(([name, value]) => {
        template = template.replace(new RegExp(`</${name}>`, 'g'), value)
    })
    return template
}

function specOpen (name, value) {
    let prefix = ''
    if (Is.String(value)) {
        if (value === 'function') {
            prefix = '#'
        }
    }
    return `describe('${prefix}${name}', () => {`
}
function testOpen() {
    return  "it('todo', function () {"
}
const specClose = '})'
const testClose = '})'
const skipTest = "it('should ...')"

function createUtilsSpecs() {

    const srcDir = abspath('src/util')
    const specDir = abspath('test/spec')
    const template = fs.readFileSync(relpath('test/templates/util.spec.template'), 'utf-8')
    const bnames = fs.readdirSync(srcDir)

    bnames.forEach(bname => {
        if (!endsWith(bname, '.js')) {
            logger.info('Skipping', bname)
            return
        }
        const name = bname.split('.').slice(0, -1).join('-')
        const specFile = resolve(specDir, name + '.test.js')
        const srcFile = resolve(srcDir, bname)
        const srcRel = relpath(srcFile)
        const specRel = relpath(specFile)
        if (fs.existsSync(specFile)) {
            logger.info('Spec exists for', logger.chalk.green(name), {file: specRel})
            return
        }
        logger.info('Creating spec for', logger.chalk.yellow(name), {file: specRel})
        const mod = require(srcFile)
        const rootOrder = revalue(mod, (v, i) => i)
        const nameHash = {}
        let spec = {}
        let count = 0
        function addSpec(obj, keyPath = []) {
            Object.entries(obj)
                .sort((a, b) => a[0].length - b[0].length)
                .forEach(([key, value]) => {
                const thisPath = keyPath.concat([key])
                if (Is.Object(value)) {
                    addSpec(value, thisPath)
                    return
                }
                const name = Is.Function(value) ? value.name : key
                const type = typeOf(value)
                if (nameHash[name]) {
                    logger.info('Skipping duplicate', {type, name})
                    return
                }
                nameHash[name] = type
                lset(spec, thisPath, type)
                count += 1
            })
        }
        addSpec(mod)
        spec = Object.fromEntries(
            Object.entries(spec).sort((a, b) => rootOrder[a[0]] - rootOrder[b[0]])
        )
        const lines = []
        const tab = 4
        const spaces = indent => ''.padEnd(indent * tab, ' ')
        function addContent(obj, indent = 1) {
            Object.entries(obj).forEach(([name, value], i) => {
                if (i > 0) {
                    lines.push('')
                }
                lines.push(spaces(indent) + specOpen(name, value))
                lines.push('')
                if (Is.String(value)) {
                    lines.push(spaces(indent + 1) + skipTest)
                    lines.push(spaces(indent + 1) + testOpen(name))
                    lines.push(spaces(indent + 2))
                    lines.push(spaces(indent + 1) + testClose)
                } else if (Is.Object(value)) {
                    addContent(value, indent + 1)
                } else {
                    logger.warn('Cannot render spec for', {type: typeOf(value)})
                }
                lines.push(spaces(indent) + specClose)
            })
        }
        addContent(spec)
        const specContent = lines.join('\n')
        const content = render(template, {name, specContent})
        fs.writeFileSync(specFile, content)
        logger.info('Wrote file with', count, 'specs')
    })
}

function main() {
    createUtilsSpecs()
}

if (require.main === module) {
    main()
}