/*
 * Copyright (c) 2014-2021 Bjoern Kimminich.
 * SPDX-License-Identifier: MIT
 */

const fs = require('fs')
const models = require('../models/index')
const insecurity = require('../lib/insecurity')
const request = require('request')
const logger = require('../lib/logger')

const ALLOWED_IMAGE_URLS = Object.freeze({
  'placecats': 'https://placecats.com/200/300',
  'placebear': 'https://placebear.com/200/300',
  'placekitten': 'https://placekitten.com/200/300',
  'placeholder': 'https://via.placeholder.com/200x300',
  'picsum': 'https://picsum.photos/200/300',
  'loremflickr': 'https://loremflickr.com/200/300',
  'pravatar': 'https://i.pravatar.cc/300'
})

function pickAllowedUrl (input) {
  if (typeof input !== 'string') return null
  for (const key of Object.keys(ALLOWED_IMAGE_URLS)) {
    if (input.indexOf(key) !== -1) {
      return ALLOWED_IMAGE_URLS[key]
    }
  }
  return null
}

module.exports = function deliberate () {
  return (req, res, next) => {
    if (req.body.imageUrl !== undefined) {
      const rawUrl = req.body.imageUrl
      if (typeof rawUrl === 'string' && rawUrl.match(/(.)*solve\/challenges\/server-side(.)*/) !== null) req.app.locals.abused_ssrf_bug = true
            const loggedInUser = insecurity.authenticatedUsers.get(req.cookies.token)
      if (loggedInUser) {
        const safeUrl = pickAllowedUrl(rawUrl)
        if (!safeUrl) {
          logger.warn('Blocked SSRF attempt for URL: ' + rawUrl)
        } else {
          const imageRequest = request
                    .get(safeUrl)
            .on('error', function (err) {
              models.User.findByPk(loggedInUser.data.id).then(user => { return user.update({ profileImage: safeUrl }) }).catch(error => { next(error) })
              logger.warn('Error retrieving user profile image: ' + err.message + '; using image link directly')
            })
            .on('response', function (res) {
              if (res.statusCode === 200) {
                const ext = ['jpg', 'jpeg', 'png', 'svg', 'gif'].includes(safeUrl.split('.').slice(-1)[0].toLowerCase()) ? safeUrl.split('.').slice(-1)[0].toLowerCase() : 'jpg'
                
           //     imageRequest.pipe(fs.createWriteStream(`frontend/dist/frontend/assets/public/images/uploads/${loggedInUser.data.id}.${ext}`))
                models.User.findByPk(loggedInUser.data.id).then(user => { return user.update({ profileImage: `/assets/public/images/uploads/${loggedInUser.data.id}.${ext}` }) }).catch(error => { next(error) })
              } else models.User.findByPk(loggedInUser.data.id).then(user => { return user.update({ profileImage: safeUrl }) }).catch(error => { next(error) })
            })
        }
      } else {
        next(new Error('Blocked illegal activity by ' + req.connection.remoteAddress))
      }
    }
    res.location(process.env.BASE_PATH + '/profile')
    res.redirect(process.env.BASE_PATH + '/profile')
  }
}
